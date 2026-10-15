import { createClient } from 'npm:@supabase/supabase-js@2'

const OPERATOR_PLAYER_ID = 'cd19b245-1a70-45de-9bb7-967f6c568425'
const URL = Deno.env.get('SUPABASE_URL') || ''
const RAW_SECRET_KEYS = Deno.env.get('SUPABASE_SECRET_KEYS') || ''
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-operator-broadcast-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders })
let db: ReturnType<typeof createClient> | null = null
function getDb() {
  if (db) return db
  if (!URL) throw new Error('SUPABASE_URL is not configured')
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const raw = RAW_SECRET_KEYS
  if (!key && raw) {
    try { key = String(JSON.parse(raw).default || '') }
    catch { throw new Error('Unable to read Supabase server key configuration') }
  }
  if (!key) throw new Error('Supabase server key is not configured')
  db = createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return db
}
function integerInRange(value: unknown, min: number, max: number) {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < min || n > max) return null
  return n
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respond({ ok: false, error: 'POST only' }, 405)

  // Public player action: one ticket for the first clear of an active world-event stage.
  // Unique (stage_id, player_id) guarantees idempotency under retries and concurrent requests.
  if (req.method === 'POST') {
    const publicBody = await req.clone().json().catch(() => null)
    if (publicBody && publicBody.action === 'world_event_stage_clear_claim') {
      try {
        const client = getDb()
        const stageId = String(publicBody.stageId || '')
        const playerId = String(publicBody.playerId || '')
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!uuid.test(stageId) || !uuid.test(playerId)) return respond({ ok: false, error: 'Invalid stage or player ID' }, 400)
        const nowDate = new Date()
        const { data: stage, error: stageError } = await client.from('world_event_stages').select('id,title,active,starts_at,expires_at,lottery_ticket_reward').eq('id', stageId).maybeSingle()
        if (stageError) return respond({ ok: false, error: 'Could not verify event stage' }, 500)
        if (!stage || stage.active !== true || !stage.lottery_ticket_reward || Date.parse(String(stage.starts_at)) > nowDate.getTime() || Date.parse(String(stage.expires_at)) <= nowDate.getTime()) return respond({ ok: false, error: 'This event stage is not active or has no ticket reward' }, 409)
        const { data: player } = await client.from('player_rankings').select('name').eq('player_id', playerId).maybeSingle()
        const ownerName = String(player?.name || 'プレイヤー').slice(0, 80)
        const { data: existingClaim } = await client.from('world_event_stage_claims').select('ticket_number').eq('stage_id', stageId).eq('player_id', playerId).maybeSingle()
        if (existingClaim) return respond({ ok: true, action: publicBody.action, granted: false, alreadyClaimed: true, ticketNumber: existingClaim.ticket_number || null })
        const { data: pendingDraws, error: pendingDrawError } = await client.from('world_lottery_draws').select('id,prizes').order('created_at', { ascending: false }).limit(50)
        if (pendingDrawError) return respond({ ok: false, error: 'Could not verify lottery status' }, 500)
        if ((pendingDraws || []).some((d: any) => d?.prizes?._status === 'announced')) return respond({ ok: false, error: 'Lottery ticket issuance is paused while the announced draw awaits reward distribution' }, 409)
        const allocateTicketNumber = async () => {
          const { data, error } = await client.rpc('allocate_world_lottery_ticket_numbers', { p_count: 1 })
          if (error || !Array.isArray(data) || !data[0]?.ticket_number) throw new Error('Could not allocate a sequential ticket number')
          return String(data[0].ticket_number)
        }
        let ticketNumber: string
        try { ticketNumber = await allocateTicketNumber() }
        catch (error) { console.error('lottery number allocation failed:', error); return respond({ ok: false, error: 'Could not allocate a ticket number' }, 503) }
        const { data: claim, error: claimError } = await client.from('world_event_stage_claims').insert({ stage_id: stageId, player_id: playerId, ticket_number: ticketNumber }).select('ticket_number').single()
        if (claimError) {
          if (claimError.code === '23505') {
            const { data: existing } = await client.from('world_event_stage_claims').select('ticket_number').eq('stage_id', stageId).eq('player_id', playerId).maybeSingle()
            return respond({ ok: true, action: publicBody.action, granted: false, alreadyClaimed: true, ticketNumber: existing?.ticket_number || null })
          }
          console.error('world event claim insert failed:', claimError.message)
          return respond({ ok: false, error: 'Could not record first-clear reward' }, 500)
        }
        ticketNumber = String(claim.ticket_number)
        let ticketInserted = false
        for (let attempt = 0; attempt < 8 && !ticketInserted; attempt++) {
          const { error: ticketError } = await client.from('world_lottery_tickets').insert({ ticket_number: ticketNumber, owner_type: 'player', owner_id: playerId, owner_name: ownerName, issued_by: 'world_event:' + stageId })
          if (!ticketError) { ticketInserted = true; break }
          if (ticketError.code !== '23505') {
            await client.from('world_event_stage_claims').delete().eq('stage_id', stageId).eq('player_id', playerId)
            console.error('world event ticket insert failed:', ticketError.message)
            return respond({ ok: false, error: 'Could not issue lottery ticket' }, 500)
          }
          try { ticketNumber = await allocateTicketNumber() } catch {
            await client.from('world_event_stage_claims').delete().eq('stage_id', stageId).eq('player_id', playerId)
            return respond({ ok: false, error: 'Could not allocate a unique ticket number' }, 503)
          }
          const { error: updateError } = await client.from('world_event_stage_claims').update({ ticket_number: ticketNumber }).eq('stage_id', stageId).eq('player_id', playerId)
          if (updateError) {
            await client.from('world_event_stage_claims').delete().eq('stage_id', stageId).eq('player_id', playerId)
            return respond({ ok: false, error: 'Could not allocate a unique ticket number' }, 500)
          }
        }
        if (!ticketInserted) {
          await client.from('world_event_stage_claims').delete().eq('stage_id', stageId).eq('player_id', playerId)
          return respond({ ok: false, error: 'Could not allocate a unique ticket number' }, 503)
        }
        return respond({ ok: true, action: publicBody.action, granted: true, ticketNumber, stageTitle: stage.title })
      } catch (error) {
        console.error('world event ticket claim failed:', error instanceof Error ? error.message : 'unknown error')
        return respond({ ok: false, error: 'Server error while issuing event ticket' }, 500)
      }
    }
  }

  const providedToken = req.headers.get('x-operator-broadcast-token') || ''
  const expectedToken = Deno.env.get('WORLD_ANNOUNCEMENT_TOKEN') || ''
  if (!expectedToken) return respond({ ok: false, error: 'Operator token is not configured in Edge Function Secrets' }, 503)
  if (!providedToken || providedToken.length !== expectedToken.length) {
    return respond({ ok: false, error: 'Invalid operator key' }, 401)
  }
  let mismatch = 0
  for (let i = 0; i < expectedToken.length; i++) mismatch |= providedToken.charCodeAt(i) ^ expectedToken.charCodeAt(i)
  if (mismatch !== 0) return respond({ ok: false, error: 'Invalid operator key' }, 401)

  try {
    const client = getDb()
    const body = await req.json()
    if (!body || typeof body !== 'object' || body.operatorId !== OPERATOR_PLAYER_ID)
      return respond({ ok: false, error: 'Operator game account check failed' }, 403)
    const action = String(body.action || '')
    const now = new Date().toISOString()

    if (action === 'publish' || action === 'clear') {
      let row: Record<string, unknown>
      if (action === 'publish') {
        const message = typeof body.message === 'string' ? body.message.trim() : ''
        const duration = integerInRange(body.durationSeconds, 30, 3600)
        if (!message || message.length > 300) return respond({ ok: false, error: 'Message must be 1-300 characters' }, 400)
        if (![30,60,300,600,1800,3600].includes(duration ?? -1)) return respond({ ok: false, error: 'Invalid announcement duration' }, 400)
        row = { id: 1, message, active: true, expires_at: new Date(Date.now() + duration! * 1000).toISOString(), updated_at: now, updated_by: OPERATOR_PLAYER_ID }
      } else row = { id: 1, message: '', active: false, expires_at: null, updated_at: now, updated_by: OPERATOR_PLAYER_ID }
      const { error } = await client.from('world_announcements').upsert(row, { onConflict: 'id' })
      if (error) { console.error('announcement write failed:', error.message); return respond({ ok: false, error: 'Announcement could not be saved' }, 500) }
      return respond({ ok: true, action, expiresAt: row.expires_at || null })
    }

    if (action === 'grant') {
      const coins = integerInRange(body.coins, 0, 1000000)
      const xp = integerInRange(body.xp, 0, 1000000)
      if (coins === null || xp === null || (coins === 0 && xp === 0))
        return respond({ ok: false, error: 'Enter coins and/or XP from 1 to 1,000,000' }, 400)
      let query = client.from('player_rankings').select('player_id,operator_pending_coins,operator_pending_xp')
      const target = String(body.target || '')
      if (target === 'single') {
        const id = String(body.playerId || '')
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
          return respond({ ok: false, error: 'A valid player UUID is required' }, 400)
        query = query.eq('player_id', id) as typeof query
      } else if (target !== 'all') return respond({ ok: false, error: 'Invalid reward target' }, 400)
      const { data: players, error: listError } = await query.limit(target === 'all' ? 1000 : 1)
      if (listError) { console.error('reward recipient lookup failed:', listError.message); return respond({ ok: false, error: 'Could not load reward recipients' }, 500) }
      if (!players?.length) return respond({ ok: false, error: 'No matching registered player was found' }, 404)
      let granted = 0
      for (const player of players) {
        const patch = {
          operator_pending_coins: Number(player.operator_pending_coins || 0) + coins,
          operator_pending_xp: Number(player.operator_pending_xp || 0) + xp,
          operator_pending_ref: crypto.randomUUID(),
          updated_at: now,
        }
        const { error } = await client.from('player_rankings').update(patch).eq('player_id', player.player_id)
        if (error) { console.error('reward write failed:', error.message); return respond({ ok: false, error: 'Reward delivery stopped after ' + granted + ' players' }, 500) }
        granted++
      }
      return respond({ ok: true, action, granted, coins, xp })
    }

    if (action === 'clear_bonus_start' || action === 'clear_bonus_stop') {
      let row: Record<string, unknown> = { id: 1, updated_at: now, updated_by: OPERATOR_PLAYER_ID }
      if (action === 'clear_bonus_start') {
        const coinMultiplier = integerInRange(body.coinMultiplier, 1, 1000)
        const xpMultiplier = integerInRange(body.xpMultiplier, 1, 1000)
        const durationMinutes = integerInRange(body.durationMinutes, 1, 43200)
        if (coinMultiplier === null || xpMultiplier === null || durationMinutes === null)
          return respond({ ok: false, error: 'Multipliers must be 1-1000 and duration 1-43200 minutes' }, 400)
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
        row = { ...row, clear_coin_multiplier: coinMultiplier, clear_xp_multiplier: xpMultiplier, clear_bonus_active: true, clear_bonus_expires_at: expiresAt, clear_bonus_updated_at: now }
      } else {
        row = { ...row, clear_coin_multiplier: 1, clear_xp_multiplier: 1, clear_bonus_active: false, clear_bonus_expires_at: null, clear_bonus_updated_at: now }
      }
      const { error } = await client.from('world_operator_state').upsert(row, { onConflict: 'id' })
      if (error) { console.error('clear bonus state write failed:', error.message); return respond({ ok: false, error: 'Could not update clear reward bonus' }, 500) }
      return respond({ ok: true, action, coinMultiplier: row.clear_coin_multiplier || 1, xpMultiplier: row.clear_xp_multiplier || 1, expiresAt: row.clear_bonus_expires_at || null })
    }

    if (['event_start','event_stop','maintenance_start','maintenance_stop'].includes(action)) {
      let row: Record<string, unknown> = { id: 1, updated_at: now, updated_by: OPERATOR_PLAYER_ID }
      if (action === 'event_start') {
        const name = typeof body.eventName === 'string' ? body.eventName.trim() : ''
        const duration = integerInRange(body.durationSeconds, 300, 86400)
        if (!name || name.length > 60) return respond({ ok: false, error: 'Event name must be 1-60 characters' }, 400)
        if (![300,1800,3600,21600,86400].includes(duration ?? -1)) return respond({ ok: false, error: 'Invalid event duration' }, 400)
        row = { ...row, event_name: name, event_active: true, event_expires_at: new Date(Date.now() + duration! * 1000).toISOString() }
      } else if (action === 'event_stop') row = { ...row, event_name: '', event_active: false, event_expires_at: null }
      else if (action === 'maintenance_start') row = { ...row, maintenance_active: true, maintenance_message: 'メンテナンスのお知らせ：運営からの案内をご確認ください。' }
      else row = { ...row, maintenance_active: false }
      const { error } = await client.from('world_operator_state').upsert(row, { onConflict: 'id' })
      if (error) { console.error('operator state write failed:', error.message); return respond({ ok: false, error: 'Could not update world state' }, 500) }
      return respond({ ok: true, action, expiresAt: row.event_expires_at || null })
    }


    if (action === 'world_event_stage_list') {
      const { data, error } = await client.from('world_event_stages').select('id,title,template_name,active,starts_at,expires_at,lottery_ticket_reward,created_at').order('created_at', { ascending: false }).limit(100)
      if (error) return respond({ ok: false, error: 'Could not load world event stages' }, 500)
      return respond({ ok: true, action, stages: data || [] })
    }
    if (action === 'world_event_stage_create') {
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      const templateName = typeof body.templateName === 'string' ? body.templateName.trim() : ''
      const durationSeconds = integerInRange(body.durationSeconds, 300, 86400)
      const lotteryTicketReward = body.lotteryTicketReward === true
      const rawRewards = Array.isArray(body.clearRewards) ? body.clearRewards : []
      if (rawRewards.length > 20) return respond({ ok: false, error: 'Too many clear rewards' }, 400)
      const allowedRewardTypes = new Set(['coins','xp','normalGold','rarityGold:レア','rarityGold:激レア','rarityGold:超激レア','rarityGold:伝説レア','power'])
      const clearRewards: Array<Record<string, unknown>> = []
      for (const item of rawRewards) {
        if (!item || typeof item !== 'object') return respond({ ok: false, error: 'Invalid clear reward' }, 400)
        const reward = item as Record<string, unknown>
        const type = String(reward.type || '')
        const amount = integerInRange(reward.amount, 1, 10000000)
        if (!allowedRewardTypes.has(type) || amount === null) return respond({ ok: false, error: 'Invalid clear reward settings' }, 400)
        clearRewards.push({ type, amount })
      }
      const rawConfig = body.stageConfig && typeof body.stageConfig === 'object' && !Array.isArray(body.stageConfig) ? body.stageConfig as Record<string, unknown> : {}
      let stageConfig: Record<string, unknown> = { clearRewards }
      if (templateName === '__custom__') {
        const width = integerInRange(rawConfig.width, 600, 12000)
        const baseHp = integerInRange(rawConfig.baseHp, 100, 1000000000)
        const xp = integerInRange(rawConfig.xp, 0, 10000000)
        const schedule = Array.isArray(rawConfig.schedule) ? rawConfig.schedule : []
        const bgm = String(rawConfig.customBgm || 'event')
        const background = String(rawConfig.customBackground || 'field')
        const allowedBgm = ['event','event_rage','event_perfect','rage','menu']
        const allowedBackground = ['field','night','space','volcano','ocean']
        if (width === null || baseHp === null || xp === null || schedule.length < 1 || schedule.length > 500 || !allowedBgm.includes(bgm) || !allowedBackground.includes(background)) return respond({ ok: false, error: 'Invalid custom stage settings' }, 400)
        const cleanSchedule: Array<Record<string, unknown>> = []
        const enemyNames = new Set<string>()
        for (const row of schedule) {
          if (!row || typeof row !== 'object') return respond({ ok: false, error: 'Invalid enemy schedule row' }, 400)
          const r = row as Record<string, unknown>
          const t = Number(r.t), mult = Number(r.mult), enemy = typeof r.enemy === 'string' ? r.enemy.trim() : ''
          const role = String(r.role || 'normal')
          if (!enemy || enemy.length > 100 || !Number.isFinite(t) || t < 0 || t > 3600 || !Number.isFinite(mult) || mult < 0.1 || mult > 100000 || !['normal','midboss','boss'].includes(role)) return respond({ ok: false, error: 'Invalid enemy schedule row' }, 400)
          enemyNames.add(enemy)
          cleanSchedule.push({ t, enemy, mult, fixedMultiplier: true, role })
        }
        if (enemyNames.size > 100) return respond({ ok: false, error: 'Too many enemy types' }, 400)
        cleanSchedule.sort((a,b) => Number(a.t) - Number(b.t))
        stageConfig = { customWorldEvent: true, width, baseHp, xp, enemies: [...enemyNames], schedule: cleanSchedule, customBgm: bgm, customBackground: background, clearRewards }
      } else if (!templateName || templateName.length > 80) {
        return respond({ ok: false, error: 'Invalid event template' }, 400)
      }
      if (!title || title.length > 60 || durationSeconds === null || ![300,1800,3600,21600,86400].includes(durationSeconds)) return respond({ ok: false, error: 'Invalid world event stage settings' }, 400)
      const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString()
      const { data, error } = await client.from('world_event_stages').insert({ title, template_name: templateName, stage_config: stageConfig, active: true, starts_at: now, expires_at: expiresAt, lottery_ticket_reward: lotteryTicketReward, created_by: OPERATOR_PLAYER_ID, updated_at: now }).select('id,title,template_name,active,starts_at,expires_at,lottery_ticket_reward').single()
      if (error || !data) { console.error('world event stage create failed:', error?.message); return respond({ ok: false, error: 'Could not create world event stage' }, 500) }
      return respond({ ok: true, action, stage: data })
    }
    if (action === 'world_event_stage_stop') {
      const stageId = String(body.stageId || '')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stageId)) return respond({ ok: false, error: 'Invalid stage ID' }, 400)
      const { data, error } = await client.from('world_event_stages').update({ active: false, updated_at: now }).eq('id', stageId).select('id').maybeSingle()
      if (error || !data) return respond({ ok: false, error: 'Could not stop world event stage' }, 500)
      return respond({ ok: true, action, stageId })
    }

    if (action === 'lottery_issue') {
      const { data: pendingDraws, error: pendingDrawError } = await client.from('world_lottery_draws').select('id,prizes').order('created_at', { ascending: false }).limit(50)
      if (pendingDrawError) return respond({ ok: false, error: 'Could not verify lottery status' }, 500)
      if ((pendingDraws || []).some((d: any) => d?.prizes?._status === 'announced')) return respond({ ok: false, error: 'Lottery ticket issuance is paused while the announced draw awaits reward distribution' }, 409)
      const target=String(body.target||''), amount=integerInRange(body.amount,1,100)
      const ids=Array.isArray(body.targetIds)?body.targetIds.map((x:unknown)=>String(x).trim()).filter(Boolean).slice(0,100):[]
      if(!amount)return respond({ok:false,error:'Ticket amount must be 1-100 per account'},400)
      if(['single','multiple'].includes(target)&&(!ids.length||(target==='single'&&ids.length!==1)))return respond({ok:false,error:'Invalid recipient list'},400)
      const recipients:{owner_type:'player'|'ai';owner_id:string;owner_name:string}[]=[]
      if(target==='all'||target==='all_players'){const {data,error}=await client.from('player_rankings').select('player_id,name').limit(2000);if(error)return respond({ok:false,error:'Could not load player recipients'},500);for(const p of data||[])recipients.push({owner_type:'player',owner_id:String(p.player_id),owner_name:String(p.name||'プレイヤー')})}
      if(target==='all'||target==='all_ai'){const {data,error}=await client.from('ai_accounts').select('account_id,name').limit(2000);if(error)return respond({ok:false,error:'Could not load AI recipients'},500);for(const a of data||[])recipients.push({owner_type:'ai',owner_id:String(a.account_id),owner_name:String(a.name||('AI-'+String(a.account_id).padStart(3,'0')))})}
      if(target==='single'||target==='multiple')for(const ident of ids){const ai=ident.match(/^AI[-_ ]?([0-9]{1,6})$/i);if(ai){const {data,error}=await client.from('ai_accounts').select('account_id,name').eq('account_id',Number(ai[1])).maybeSingle();if(error)return respond({ok:false,error:'Could not resolve AI recipient'},500);if(data)recipients.push({owner_type:'ai',owner_id:String(data.account_id),owner_name:String(data.name||ident)});continue}const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ident);let q=client.from('player_rankings').select('player_id,name');q=isUuid?q.eq('player_id',ident):q.eq('name',ident);const {data,error}=await q.limit(1).maybeSingle();if(error)return respond({ok:false,error:'Could not resolve player recipient'},500);if(data)recipients.push({owner_type:'player',owner_id:String(data.player_id),owner_name:String(data.name||ident)});else if(!isUuid){const {data:a,error:ae}=await client.from('ai_accounts').select('account_id,name').eq('name',ident).limit(1).maybeSingle();if(ae)return respond({ok:false,error:'Could not resolve AI recipient'},500);if(a)recipients.push({owner_type:'ai',owner_id:String(a.account_id),owner_name:String(a.name||ident)})}}
      const unique=[...new Map(recipients.map(r=>[r.owner_type+':'+r.owner_id,r])).values()]
      if(!unique.length)return respond({ok:false,error:'No matching account found'},404)
      if(unique.length*amount>10000)return respond({ok:false,error:'Limit is 10,000 tickets per operation'},400)
      const total=unique.length*amount
      const {data:numberRows,error:numberError}=await client.rpc('allocate_world_lottery_ticket_numbers',{p_count:total})
      if(numberError||!Array.isArray(numberRows)||numberRows.length!==total)return respond({ok:false,error:'Could not allocate sequential ticket numbers'},503)
      const rows:Record<string,unknown>[]=[]
      let numberIndex=0
      for(const r of unique)for(let n=0;n<amount;n++)rows.push({ticket_number:String(numberRows[numberIndex++].ticket_number),owner_type:r.owner_type,owner_id:r.owner_id,owner_name:r.owner_name,issued_by:OPERATOR_PLAYER_ID})
      let issued=0
      for(let i=0;i<rows.length;i+=200){
        let batch=rows.slice(i,i+200),done=false
        for(let tries=0;tries<5&&!done;tries++){
          const {error}=await client.from('world_lottery_tickets').insert(batch)
          if(!error){issued+=batch.length;done=true}
          else if(error.code==='23505'){
            const {data:replacement,error:allocationError}=await client.rpc('allocate_world_lottery_ticket_numbers',{p_count:batch.length})
            if(allocationError||!Array.isArray(replacement)||replacement.length!==batch.length)return respond({ok:false,error:'Could not reallocate unique ticket numbers; issued '+issued},503)
            batch=batch.map((row,index)=>({...row,ticket_number:String(replacement[index].ticket_number)}))
          }else return respond({ok:false,error:'Ticket issuance stopped after '+issued+' tickets'},500)
        }
        if(!done)return respond({ok:false,error:'Could not allocate unique numbers; issued '+issued},503)
      }
      return respond({ok:true,action,issued,recipients:unique.length})
    }
    if (action === 'lottery_random_numbers') {
      const { data: tickets, error } = await client.from('world_lottery_tickets').select('ticket_number').is('draw_id', null).order('created_at', { ascending: true }).limit(10000)
      if (error) return respond({ ok: false, error: 'Could not load issued ticket numbers' }, 500)
      const numbers = (tickets || []).map((t: {ticket_number: unknown}) => String(t.ticket_number || '')).filter((n: string) => /^[0-9]{6}$/.test(n))
      if (!numbers.length) return respond({ ok: false, error: 'No issued lottery tickets are available for a random draw' }, 409)
      const pick = () => {
        const buf = new Uint32Array(1), limit = Math.floor(0x100000000 / numbers.length) * numbers.length
        do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
        return numbers[buf[0] % numbers.length]
      }
      const first = pick(), second = pick(), third = pick(), fourth = pick()
      const rangeStart = Math.min(Number(fourth), 999900)
      return respond({ ok: true, action, winningNumbers: { '1': first, '2': second.slice(-4), '3': third.slice(-2), '4Start': String(rangeStart).padStart(6, '0'), '4End': String(rangeStart + 99).padStart(6, '0') } })
    }

    if (action === 'lottery_announce' || action === 'lottery_award' || action === 'lottery_publish') {
      let pendingDraw: any = null
      if (action === 'lottery_award') {
        const { data: recentDraws, error: pendingError } = await client.from('world_lottery_draws').select('id,title,winning_number,prizes,created_at').order('created_at', { ascending: false }).limit(50)
        if (pendingError) return respond({ ok: false, error: 'Could not load pending lottery draw' }, 500)
        pendingDraw = (recentDraws || []).find((d: any) => d?.prizes?._status === 'announced') || null
        if (!pendingDraw) return respond({ ok: false, error: 'No announced lottery is waiting for reward distribution' }, 409)
        body.title = pendingDraw.title
        body.prizes = pendingDraw.prizes
        body.winningNumbers = pendingDraw.prizes?._winningNumbers
      }
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      const input = body.prizes && typeof body.prizes === 'object' ? body.prizes : {}
      const allowed = ['coins', 'xp', 'item', 'character', 'limited_character']
      const items = ['power_chest', 'wooden_chest', 'silver_chest', 'golden_chest', 'skill_crystal', 'ability_core', 'operator_chest', 'special_operator_chest']
      const legacyMode = !(body.winningNumbers && typeof body.winningNumbers === 'object')
      const suppliedNumbers = body.winningNumbers && typeof body.winningNumbers === 'object' ? body.winningNumbers : {}
      const legacyNumber = String(body.winningNumber || '').replace(/[^0-9]/g, '')
      const winningNumbers: Record<string, string> = {
        '1': String(suppliedNumbers['1'] || legacyNumber).replace(/[^0-9]/g, ''),
        '2': String(suppliedNumbers['2'] || legacyNumber.slice(-4)).replace(/[^0-9]/g, ''),
        '3': String(suppliedNumbers['3'] || legacyNumber.slice(-2)).replace(/[^0-9]/g, ''),
        '4Start': String(suppliedNumbers['4Start'] || (legacyMode ? '999900' : '')).replace(/[^0-9]/g, ''),
        '4End': String(suppliedNumbers['4End'] || (legacyMode ? '999999' : '')).replace(/[^0-9]/g, '')
      }
      if (!title || title.length > 60 || !/^[0-9]{6}$/.test(winningNumbers['1']) || !/^[0-9]{4}$/.test(winningNumbers['2']) || !/^[0-9]{2}$/.test(winningNumbers['3']) || !/^[0-9]{6}$/.test(winningNumbers['4Start']) || !/^[0-9]{6}$/.test(winningNumbers['4End']) || Number(winningNumbers['4End']) - Number(winningNumbers['4Start']) !== 99) {
        return respond({ ok: false, error: 'Enter a six-digit first-prize number, four-digit second-prize number, two-digit third-prize number, and an inclusive 100-number fourth-prize range' }, 400)
      }
      const prizes: Record<string, {type:string;value:string;amount:number}[]> = {}
      for (const tier of (legacyMode ? ['1', '2', '3'] : ['1', '2', '3', '4', '5', '6', '7'])) {
        const raw = input[tier]
        const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []
        if (!rows.length || rows.length > 10) return respond({ ok: false, error: 'Set 1-10 rewards for tier ' + tier }, 400)
        prizes[tier] = []
        for (const row of rows) {
          const type = String(row?.type || ''), value = String(row?.value || '').trim(), amount = integerInRange(row?.amount, 1, 1000000)
          if (!allowed.includes(type) || !value || value.length > 80 || !amount) return respond({ ok: false, error: 'Invalid prize for tier ' + tier }, 400)
          if ((type === 'coins' || type === 'xp') && !/^[0-9]+$/.test(value)) return respond({ ok: false, error: 'Coin/XP value must be numeric' }, 400)
          if (type === 'item' && !items.includes(value)) return respond({ ok: false, error: 'Unsupported item ID' }, 400)
          if ((type === 'character' || type === 'limited_character') && amount !== 1) return respond({ ok: false, error: 'Character prize amount must be 1' }, 400)
          prizes[tier].push({ type, value, amount })
        }
      }
      if (legacyMode) {
        prizes['4'] = []
        prizes['5'] = [{ type: 'coins', value: '5000', amount: 1 }]
        prizes['6'] = [{ type: 'coins', value: '1000', amount: 1 }]
        prizes['7'] = [{ type: 'coins', value: '100', amount: 1 }]
      }
      let draw: any = pendingDraw
      if (action !== 'lottery_award') {
        if (action === 'lottery_announce') {
          const { data: recentDraws, error: pendingError } = await client.from('world_lottery_draws').select('id,prizes,created_at').order('created_at', { ascending: false }).limit(50)
          if (pendingError) return respond({ ok: false, error: 'Could not check pending lottery announcements' }, 500)
          if ((recentDraws || []).some((d: any) => d?.prizes?._status === 'announced')) return respond({ ok: false, error: 'A lottery announcement is already waiting for reward distribution. Distribute its rewards first.' }, 409)
        }
        const storedPrizes = { ...prizes, _winningNumbers: winningNumbers, _status: action === 'lottery_announce' ? 'announced' : 'awarding' }
        const { data: createdDraw, error: de } = await client.from('world_lottery_draws').insert({ title, winning_number: winningNumbers['1'], prizes: storedPrizes, published_by: OPERATOR_PLAYER_ID }).select('id,title,prizes').single()
        if (de || !createdDraw) return respond({ ok: false, error: 'Could not create draw' }, 500)
        draw = createdDraw
        if (action === 'lottery_announce') {
          const announcement = '🎟️ ' + title + ' 当選番号を事前発表！ 1等 ' + winningNumbers['1'] + '（最大1口）／2等 下4桁 ' + winningNumbers['2'] + '（最大2口）／3等 下2桁 ' + winningNumbers['3'] + '（最大10口）。報酬はまだ配布していません。'
          const { error: announceError } = await client.from('world_announcements').upsert({ id: 1, message: announcement, active: true, expires_at: new Date(Date.now() + 3600000).toISOString(), updated_at: now, updated_by: OPERATOR_PLAYER_ID }, { onConflict: 'id' })
          if (announceError) return respond({ ok: false, error: 'Numbers were saved, but the announcement could not be published' }, 500)
          return respond({ ok: true, action, title, drawId: draw.id, announced: true, rewardGranted: false, winningNumbers })
        }
      } else {
        draw = pendingDraw
      }
      const { data: tickets, error: te } = await client.from('world_lottery_tickets').select('id,ticket_number,owner_type,owner_id,owner_name').is('draw_id', null).order('created_at', { ascending: true }).limit(10000)
      if (te) return respond({ ok: false, error: 'Could not load tickets' }, 500)
      const buckets: Record<string, any[]> = { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], none: [] }
      const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 }
      const rangeStart = Number(winningNumbers['4Start']), rangeEnd = Number(winningNumbers['4End'])
      for (const t of tickets || []) {
        const n = String(t.ticket_number || ''), numeric = Number(n)
        const tier = n === winningNumbers['1'] ? '1' : n.slice(-4) === winningNumbers['2'] ? '2' : n.slice(-2) === winningNumbers['3'] ? '3' : !legacyMode && numeric >= rangeStart && numeric <= rangeEnd ? '4' : 'none'
        buckets[tier].push(t)
      }
      // Enforce ticket-count caps: 1st max 1, 2nd max 2, 3rd max 10. Extra matching tickets do not become lower numbered prizes.
      const drawRandomIndex = (max: number): number => {
        const buf = new Uint32Array(1), limit = Math.floor(0x100000000 / max) * max
        do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
        return buf[0] % max
      }
      const takeRandomUpTo = (source: any[], cap: number): any[] => {
        const pool = source.slice(), selected: any[] = []
        while (pool.length && selected.length < cap) selected.push(pool.splice(drawRandomIndex(pool.length), 1)[0])
        buckets.none.push(...pool)
        return selected
      }
      buckets['1'] = takeRandomUpTo(buckets['1'], 1)
      buckets['2'] = takeRandomUpTo(buckets['2'], 2)
      buckets['3'] = takeRandomUpTo(buckets['3'], 10)
      // Randomly select distinct 5th- and 6th-prize tickets only from tickets that missed 1st-4th.
      const lowerPrizeCandidates = buckets.none
      for (const tier of ['5', '6']) {
        if (lowerPrizeCandidates.length) buckets[tier].push(lowerPrizeCandidates.splice(drawRandomIndex(lowerPrizeCandidates.length), 1)[0])
      }
      buckets['7'].push(...lowerPrizeCandidates.splice(0))
      buckets.none = []
      for (const tier of ['1', '2', '3', '4', '5', '6', '7']) counts[tier] = buckets[tier].length
      for (const tier of ['1', '2', '3', '4', '5', '6', '7']) {
        for (let i = 0; i < buckets[tier].length; i += 250) {
          const ids = buckets[tier].slice(i, i + 250).map((t: any) => String(t.id))
          const { error } = await client.from('world_lottery_tickets').update({ draw_id: draw.id, prize_tier: tier, reward_granted: false }).in('id', ids)
          if (error) return respond({ ok: false, error: 'Could not finalize ticket results' }, 500)
        }
      }
      let awarded = 0
      for (const tier of ['1', '2', '3', '4', '5', '6', '7']) {
        const rewardList = prizes[tier] || []
        for (const t of buckets[tier]) {
          const owner = String(t.owner_id), kind = String(t.owner_type)
          if (kind === 'ai') {
            const { data: a, error: ae } = await client.from('ai_accounts').select('coins,player_xp,inventory_items,owned_characters,limited_character_owned').eq('account_id', Number(owner)).maybeSingle()
            if (ae || !a) return respond({ ok: false, error: 'Could not load AI winner' }, 500)
            let coinAdd = 0, xpAdd = 0, limited = Boolean(a.limited_character_owned)
            const inventory = { ...(a.inventory_items && typeof a.inventory_items === 'object' ? a.inventory_items : {}) } as Record<string, number>
            const characters = new Set<string>(Array.isArray(a.owned_characters) ? a.owned_characters.map(String) : [])
            for (const p of rewardList) {
              if (p.type === 'coins') coinAdd += Number(p.value) * p.amount
              else if (p.type === 'xp') xpAdd += Number(p.value) * p.amount
              else if (p.type === 'item') inventory[p.value] = Number(inventory[p.value] || 0) + p.amount
              else { characters.add(String(p.value)); if (p.type === 'limited_character' && String(p.value) === '木下&吉田') limited = true }
            }
            const patch: Record<string, unknown> = { updated_at: now }
            if (coinAdd) patch.coins = Number(a.coins || 0) + coinAdd
            if (xpAdd) patch.player_xp = Number(a.player_xp || 0) + xpAdd
            if (rewardList.some(p => p.type === 'item')) patch.inventory_items = inventory
            if (rewardList.some(p => p.type === 'character' || p.type === 'limited_character')) patch.owned_characters = [...characters]
            if (limited !== Boolean(a.limited_character_owned)) patch.limited_character_owned = limited
            const { error } = await client.from('ai_accounts').update(patch).eq('account_id', Number(owner))
            if (error) return respond({ ok: false, error: 'Could not grant AI prize' }, 500)
          } else {
            const { data: a, error: ae } = await client.from('player_rankings').select('operator_pending_coins,operator_pending_xp,operator_pending_ref,operator_pending_items,operator_pending_items_ref,operator_pending_lottery_rewards,limited_character_owned').eq('player_id', owner).maybeSingle()
            if (ae || !a) return respond({ ok: false, error: 'Could not load player winner' }, 500)
            let coinAdd = 0, xpAdd = 0, limited = Boolean(a.limited_character_owned)
            const inventory = { ...(a.operator_pending_items && typeof a.operator_pending_items === 'object' ? a.operator_pending_items : {}) } as Record<string, number>
            const pending = Array.isArray(a.operator_pending_lottery_rewards) ? [...a.operator_pending_lottery_rewards] : []
            for (const p of rewardList) {
              if (p.type === 'coins') coinAdd += Number(p.value) * p.amount
              else if (p.type === 'xp') xpAdd += Number(p.value) * p.amount
              else if (p.type === 'item') inventory[p.value] = Number(inventory[p.value] || 0) + p.amount
              else { pending.push({ type: p.type, value: String(p.value), amount: p.amount, drawId: draw.id, tier }); if (p.type === 'limited_character') limited = true }
            }
            const patch: Record<string, unknown> = { updated_at: now }
            if (coinAdd) { patch.operator_pending_coins = Number(a.operator_pending_coins || 0) + coinAdd; patch.operator_pending_ref = crypto.randomUUID() }
            if (xpAdd) { patch.operator_pending_xp = Number(a.operator_pending_xp || 0) + xpAdd; patch.operator_pending_ref = crypto.randomUUID() }
            if (rewardList.some(p => p.type === 'item')) { patch.operator_pending_items = inventory; patch.operator_pending_items_ref = crypto.randomUUID() }
            if (rewardList.some(p => p.type === 'character' || p.type === 'limited_character')) { patch.operator_pending_lottery_rewards = pending; patch.operator_pending_lottery_ref = crypto.randomUUID() }
            if (limited !== Boolean(a.limited_character_owned)) patch.limited_character_owned = limited
            const { error } = await client.from('player_rankings').update(patch).eq('player_id', owner)
            if (error) return respond({ ok: false, error: 'Could not queue player prize' }, 500)
          }
          const { error: ticketUpdateError } = await client.from('world_lottery_tickets').update({ reward_granted: true, reward_result: { tier, rewards: rewardList } }).eq('id', String(t.id))
          if (ticketUpdateError) return respond({ ok: false, error: 'Could not mark ticket rewards as granted' }, 500)
          awarded++
        }
      }
      await client.from('world_lottery_draws').update({ prizes: { ...prizes, _status: 'awarded', _winningNumbers: winningNumbers }, ticket_count: (tickets || []).length, winner_counts: counts, awarded_count: awarded }).eq('id', draw.id)
      const announcement = legacyMode
        ? '🎟️ ' + title + ' 当選結果・報酬付与完了！ 1等 ' + winningNumbers['1'] + '／2等 下4桁 ' + winningNumbers['2'] + '／3等 下2桁 ' + winningNumbers['3'] + '。アイテムバッグで報酬を確認してください。'
        : '🎟️ ' + title + ' 当選結果・報酬付与完了！ 1等 ' + winningNumbers['1'] + '（最大1口）／2等 下4桁 ' + winningNumbers['2'] + '（最大2口）／3等 下2桁 ' + winningNumbers['3'] + '（最大10口）／4等 ' + winningNumbers['4Start'] + '〜' + winningNumbers['4End'] + '。5・6等は1〜4等に外れたチケットから各1口をランダム抽選、残りは7等参加賞です。アイテムバッグで報酬を確認してください。'
      await client.from('world_announcements').upsert({ id: 1, message: announcement, active: true, expires_at: new Date(Date.now() + 3600000).toISOString(), updated_at: now, updated_by: OPERATOR_PLAYER_ID }, { onConflict: 'id' })
      return respond({ ok: true, action: action === 'lottery_award' ? 'lottery_award' : 'lottery_publish', title, drawId: draw.id, winners: Object.values(counts).reduce((sum, count) => sum + count, 0), prizeCounts: counts, awarded }
    }
    return respond({ ok: false, error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('operator handler failed:', error instanceof Error ? error.message : 'unknown error')
    return respond({ ok: false, error: 'Server error while processing operator command' }, 500)
  }
})
