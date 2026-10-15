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

    if (action === 'lottery_issue') {
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
      const used=new Set<string>(), rows:Record<string,unknown>[]=[]
      const rnd=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return String(a[0]%1000000).padStart(6,'0')}
      for(const r of unique)for(let n=0;n<amount;n++){let num=rnd(),tries=0;while(used.has(num)&&tries++<100)num=rnd();if(used.has(num))return respond({ok:false,error:'Unique number generation failed'},503);used.add(num);rows.push({ticket_number:num,owner_type:r.owner_type,owner_id:r.owner_id,owner_name:r.owner_name,issued_by:OPERATOR_PLAYER_ID})}
      let issued=0
      for(let i=0;i<rows.length;i+=200){let batch=rows.slice(i,i+200),done=false;for(let tries=0;tries<5&&!done;tries++){const {error}=await client.from('world_lottery_tickets').insert(batch);if(!error){issued+=batch.length;done=true}else if(error.code==='23505'){for(const row of batch){let num=rnd(),n=0;while(used.has(num)&&n++<100)num=rnd();used.add(num);row.ticket_number=num}}else return respond({ok:false,error:'Ticket issuance stopped after '+issued+' tickets'},500)}if(!done)return respond({ok:false,error:'Could not allocate unique numbers; issued '+issued},503)}
      return respond({ok:true,action,issued,recipients:unique.length})
    }
    if (action === 'lottery_publish') {
      const title=typeof body.title==='string'?body.title.trim():'', winningNumber=String(body.winningNumber||'').replace(/[^0-9]/g,'')
      const input=body.prizes&&typeof body.prizes==='object'?body.prizes:{}, allowed=['coins','xp','item','character','limited_character'], items=['power_chest','wooden_chest','silver_chest','golden_chest','skill_crystal','ability_core','operator_chest','special_operator_chest']
      if(!title||title.length>60||! /^[0-9]{6}$/.test(winningNumber))return respond({ok:false,error:'Invalid lottery title or six-digit number'},400)
      type LotteryPrize={type:string;value:string;amount:number}
      const prizes:Record<string,LotteryPrize[]>={}
      for(const tier of ['1','2','3']){
        const raw=input[tier], list=Array.isArray(raw)?raw:[raw||{}]
        if(!list.length||list.length>10)return respond({ok:false,error:'Each tier must have 1-10 rewards'},400)
        const normalized:LotteryPrize[]=[]
        for(const p of list){
          const type=String(p?.type||''),value=String(p?.value||'').trim(),amount=integerInRange(p?.amount,1,1000000)
          if(!allowed.includes(type)||!value||value.length>80||!amount)return respond({ok:false,error:'Invalid prize for tier '+tier},400)
          if((type==='coins'||type==='xp')&&!/^[0-9]+$/.test(value))return respond({ok:false,error:'Coin/XP value must be numeric'},400)
          if(type==='item'&&!items.includes(value))return respond({ok:false,error:'Unsupported item ID'},400)
          if((type==='character'||type==='limited_character')&&amount!==1)return respond({ok:false,error:'Character reward amount must be 1'},400)
          normalized.push({type,value,amount})
        }
        prizes[tier]=normalized
      }
      const {data:draw,error:de}=await client.from('world_lottery_draws').insert({title,winning_number:winningNumber,prizes,published_by:OPERATOR_PLAYER_ID}).select('id').single();if(de||!draw)return respond({ok:false,error:'Could not create draw'},500)
      const {data:tickets,error:te}=await client.from('world_lottery_tickets').select('id,ticket_number,owner_type,owner_id,owner_name').is('draw_id',null).order('created_at',{ascending:true}).limit(10000);if(te)return respond({ok:false,error:'Could not load tickets'},500)
      const buckets:Record<string,any[]>={'1':[],'2':[],'3':[],none:[]}, counts:Record<string,number>={'1':0,'2':0,'3':0}
      for(const t of tickets||[]){const n=String(t.ticket_number||'');const tier=n===winningNumber?'1':n.slice(-4)===winningNumber.slice(-4)?'2':n.slice(-2)===winningNumber.slice(-2)?'3':'none';buckets[tier].push(t);if(tier!=='none')counts[tier]++}
      for(const tier of ['1','2','3','none'])for(let i=0;i<buckets[tier].length;i+=250){const ids=buckets[tier].slice(i,i+250).map(t=>String(t.id));const {error}=await client.from('world_lottery_tickets').update({draw_id:draw.id,prize_tier:tier==='none'?null:tier,reward_granted:tier==='none'}).in('id',ids);if(error)return respond({ok:false,error:'Could not finalize ticket results'},500)}
      let awarded=0
      for(const tier of ['1','2','3'])for(const t of buckets[tier]){
        const rewards=prizes[tier],owner=String(t.owner_id),kind=String(t.owner_type),rewardResults=rewards.map(p=>({type:p.type,value:p.value,amount:p.amount}))
        if(kind==='ai'){
          const {data:a,error:ae}=await client.from('ai_accounts').select('coins,player_xp,inventory_items,owned_characters,limited_character_owned').eq('account_id',Number(owner)).maybeSingle();if(ae||!a)return respond({ok:false,error:'Could not load AI winner'},500)
          const patch:Record<string,unknown>={updated_at:now},inv={...(a.inventory_items&&typeof a.inventory_items==='object'?a.inventory_items:{})},chars=Array.isArray(a.owned_characters)?[...a.owned_characters]:[]
          let coins=Number(a.coins||0),xp=Number(a.player_xp||0),limitedOwned=Boolean(a.limited_character_owned)
          for(const p of rewards){const amount=Number(p.amount),value=p.value;if(p.type==='coins')coins+=Number(value)*amount;else if(p.type==='xp')xp+=Number(value)*amount;else if(p.type==='item')inv[value]=Number(inv[value]||0)+amount;else{if(!chars.includes(String(value)))chars.push(String(value));if(p.type==='limited_character'&&String(value)==='木下&吉田')limitedOwned=true}}
          if(rewards.some(p=>p.type==='coins'))patch.coins=coins
          if(rewards.some(p=>p.type==='xp'))patch.player_xp=xp
          if(rewards.some(p=>p.type==='item'))patch.inventory_items=inv
          if(rewards.some(p=>['character','limited_character'].includes(p.type)))patch.owned_characters=chars
          if(limitedOwned!==Boolean(a.limited_character_owned))patch.limited_character_owned=limitedOwned
          const {error}=await client.from('ai_accounts').update(patch).eq('account_id',Number(owner));if(error)return respond({ok:false,error:'Could not grant AI prize'},500)
        }else{
          const {data:a,error:ae}=await client.from('player_rankings').select('operator_pending_coins,operator_pending_xp,operator_pending_ref,operator_pending_items,operator_pending_items_ref,operator_pending_lottery_rewards,limited_character_owned').eq('player_id',owner).maybeSingle();if(ae||!a)return respond({ok:false,error:'Could not load player winner'},500)
          const patch:Record<string,unknown>={updated_at:now},inv={...(a.operator_pending_items&&typeof a.operator_pending_items==='object'?a.operator_pending_items:{})},pending=Array.isArray(a.operator_pending_lottery_rewards)?[...a.operator_pending_lottery_rewards]:[]
          let coins=Number(a.operator_pending_coins||0),xp=Number(a.operator_pending_xp||0),limitedOwned=Boolean(a.limited_character_owned),coinChanged=false,xpChanged=false,itemChanged=false
          for(const p of rewards){const amount=Number(p.amount),value=p.value;if(p.type==='coins'){coins+=Number(value)*amount;coinChanged=true}else if(p.type==='xp'){xp+=Number(value)*amount;xpChanged=true}else if(p.type==='item'){inv[value]=Number(inv[value]||0)+amount;itemChanged=true}else{pending.push({type:p.type,value:String(value),amount,drawId:draw.id,tier});if(p.type==='limited_character'&&String(value)==='木下&吉田')limitedOwned=true}}
          if(coinChanged){patch.operator_pending_coins=coins;patch.operator_pending_ref=crypto.randomUUID()}
          if(xpChanged){patch.operator_pending_xp=xp;patch.operator_pending_ref=crypto.randomUUID()}
          if(itemChanged){patch.operator_pending_items=inv;patch.operator_pending_items_ref=crypto.randomUUID()}
          if(pending.length!==(Array.isArray(a.operator_pending_lottery_rewards)?a.operator_pending_lottery_rewards.length:0)){patch.operator_pending_lottery_rewards=pending;patch.operator_pending_lottery_ref=crypto.randomUUID()}
          if(limitedOwned!==Boolean(a.limited_character_owned))patch.limited_character_owned=limitedOwned
          const {error}=await client.from('player_rankings').update(patch).eq('player_id',owner);if(error)return respond({ok:false,error:'Could not queue player prize'},500)
        }
        const {error:ticketError}=await client.from('world_lottery_tickets').update({reward_granted:true,reward_result:{tier,rewards:rewardResults}}).eq('id',String(t.id));if(ticketError)return respond({ok:false,error:'Could not save ticket reward result'},500)
        awarded++
      }
      const {error:de2}=await client.from('world_lottery_draws').update({ticket_count:(tickets||[]).length,winner_counts:counts,awarded_count:awarded}).eq('id',draw.id);if(de2)return respond({ok:false,error:'Could not save draw summary'},500)
      await client.from('world_announcements').upsert({id:1,message:'🎟️ '+title+' 当選発表！番号 '+winningNumber.slice(0,2)+'-'+winningNumber.slice(2)+'／1等6桁・2等下4桁・3等下2桁一致。アイテムバッグでチケット番号を確認してください。',active:true,expires_at:new Date(Date.now()+3600000).toISOString(),updated_at:now,updated_by:OPERATOR_PLAYER_ID},{onConflict:'id'})
      return respond({ok:true,action,title,drawId:draw.id,winners:counts['1']+counts['2']+counts['3'],prizeCounts:counts,awarded})
    }
    return respond({ ok: false, error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('operator handler failed:', error instanceof Error ? error.message : 'unknown error')
    return respond({ ok: false, error: 'Server error while processing operator command' }, 500)
  }
})
