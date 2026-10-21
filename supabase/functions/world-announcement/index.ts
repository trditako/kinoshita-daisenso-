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
        const { data: pendingDraws, error: pendingDrawError } = await client.from('world_lottery_draws').select('id,prizes').order('published_at', { ascending: false }).limit(50)
        if (pendingDrawError) return respond({ ok: false, error: 'Could not verify lottery status' }, 500)
        if ((pendingDraws || []).some((d: any) => ['announced', 'awarding'].includes(String(d?.prizes?._status || '')))) return respond({ ok: false, error: 'Lottery ticket issuance is paused until the announced draw is awarded' }, 409)
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
      // Make each announcement revision unique even when several posts land in the same millisecond.
      const { data: previousAnnouncement, error: previousAnnouncementError } = await client.from('world_announcements').select('updated_at').eq('id', 1).maybeSingle()
      if (previousAnnouncementError) return respond({ ok: false, error: 'Could not read previous announcement state' }, 500)
      const previousUpdatedAt = Date.parse(String(previousAnnouncement?.updated_at || ''))
      const announcementUpdatedAt = new Date(Math.max(Date.now(), Number.isFinite(previousUpdatedAt) ? previousUpdatedAt + 1 : 0)).toISOString()
      if (action === 'publish') {
        const message = typeof body.message === 'string' ? body.message.trim() : ''
        const duration = integerInRange(body.durationSeconds, 30, 3600)
        if (!message || message.length > 300) return respond({ ok: false, error: 'Message must be 1-300 characters' }, 400)
        if (![30,60,300,600,1800,3600].includes(duration ?? -1)) return respond({ ok: false, error: 'Invalid announcement duration' }, 400)
        row = { id: 1, message, active: true, expires_at: new Date(Date.now() + duration! * 1000).toISOString(), updated_at: announcementUpdatedAt, updated_by: OPERATOR_PLAYER_ID }
      } else row = { id: 1, message: '', active: false, expires_at: null, updated_at: announcementUpdatedAt, updated_by: OPERATOR_PLAYER_ID }
      const { error } = await client.from('world_announcements').upsert(row, { onConflict: 'id' })
      if (error) { console.error('announcement write failed:', error.message); return respond({ ok: false, error: 'Announcement could not be saved' }, 500) }
      return respond({ ok: true, action, expiresAt: row.expires_at || null })
    }

    if (action === 'grant') {
      const coins = integerInRange(body.coins, 0, 1000000)
      const xp = integerInRange(body.xp, 0, 1000000)
      if (coins === null || xp === null || (coins === 0 && xp === 0))
        return respond({ ok: false, error: 'Enter coins and/or XP from 1 to 1,000,000' }, 400)
      const target = String(body.target || '')
      const ids = Array.isArray(body.targetIds) ? body.targetIds.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 100) : []
      if (!['single','multiple','all','all_players','all_ai'].includes(target)) return respond({ ok: false, error: 'Invalid reward target' }, 400)
      if ((target === 'single' && ids.length !== 1) || (target === 'multiple' && ids.length < 1)) return respond({ ok: false, error: 'Invalid recipient list' }, 400)
      const recipients: { kind: 'player'|'ai'; id: string|number }[] = []
      if (target === 'all' || target === 'all_players') {
        const { data, error } = await client.from('player_rankings').select('player_id').limit(2000)
        if (error) return respond({ ok: false, error: 'Could not load player recipients' }, 500)
        for (const p of data || []) recipients.push({ kind: 'player', id: String(p.player_id) })
      }
      if (target === 'all' || target === 'all_ai') {
        const { data, error } = await client.from('ai_accounts').select('account_id').limit(2000)
        if (error) return respond({ ok: false, error: 'Could not load AI recipients' }, 500)
        for (const a of data || []) recipients.push({ kind: 'ai', id: Number(a.account_id) })
      }
      if (target === 'single' || target === 'multiple') {
        for (const ident of ids) {
          const ai = ident.match(/^AI[-_ ]?([0-9]{1,6})$/i)
          if (ai) {
            const { data, error } = await client.from('ai_accounts').select('account_id').eq('account_id', Number(ai[1])).maybeSingle()
            if (error) return respond({ ok: false, error: 'Could not resolve AI recipient' }, 500)
            if (data) recipients.push({ kind: 'ai', id: Number(data.account_id) })
            continue
          }
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ident)
          let q = client.from('player_rankings').select('player_id')
          q = isUuid ? q.eq('player_id', ident) : q.eq('name', ident)
          const { data, error } = await q.limit(1).maybeSingle()
          if (error) return respond({ ok: false, error: 'Could not resolve player recipient' }, 500)
          if (data) recipients.push({ kind: 'player', id: String(data.player_id) })
          else if (!isUuid) {
            const { data: a, error: ae } = await client.from('ai_accounts').select('account_id').eq('name', ident).limit(1).maybeSingle()
            if (ae) return respond({ ok: false, error: 'Could not resolve AI recipient' }, 500)
            if (a) recipients.push({ kind: 'ai', id: Number(a.account_id) })
          }
        }
      }
      const unique = [...new Map(recipients.map(r => [r.kind + ':' + r.id, r])).values()]
      if (!unique.length) return respond({ ok: false, error: 'No matching account found' }, 404)
      if (unique.length > 2000) return respond({ ok: false, error: 'Limit is 2,000 recipients per operation' }, 400)
      let grantedPlayers = 0, grantedAi = 0
      for (const recipient of unique) {
        if (recipient.kind === 'ai') {
          const { data: a, error } = await client.from('ai_accounts').select('coins,player_xp').eq('account_id', Number(recipient.id)).maybeSingle()
          if (error || !a) return respond({ ok: false, error: 'Reward delivery stopped after ' + (grantedPlayers + grantedAi) + ' accounts' }, 500)
          const { error: updateError } = await client.from('ai_accounts').update({
            coins: Math.min(2147483647, Number(a.coins || 0) + coins),
            player_xp: Math.min(2147483647, Number(a.player_xp || 0) + xp),
            updated_at: now
          }).eq('account_id', Number(recipient.id))
          if (updateError) return respond({ ok: false, error: 'Reward delivery stopped after ' + (grantedPlayers + grantedAi) + ' accounts' }, 500)
          grantedAi++
        } else {
          const { data: p, error } = await client.from('player_rankings').select('operator_pending_coins,operator_pending_xp').eq('player_id', String(recipient.id)).maybeSingle()
          if (error || !p) return respond({ ok: false, error: 'Reward delivery stopped after ' + (grantedPlayers + grantedAi) + ' accounts' }, 500)
          const patch: Record<string, unknown> = { updated_at: now, operator_pending_ref: crypto.randomUUID() }
          if (coins) patch.operator_pending_coins = Number(p.operator_pending_coins || 0) + coins
          if (xp) patch.operator_pending_xp = Number(p.operator_pending_xp || 0) + xp
          const { error: updateError } = await client.from('player_rankings').update(patch).eq('player_id', String(recipient.id))
          if (updateError) return respond({ ok: false, error: 'Reward delivery stopped after ' + (grantedPlayers + grantedAi) + ' accounts' }, 500)
          grantedPlayers++
        }
      }
      return respond({ ok: true, action, granted: grantedPlayers + grantedAi, grantedPlayers, grantedAi, coins, xp })
    }

    if (action === 'grant_item') {
      const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : ''
      const amount = integerInRange(body.amount, 1, 1000000)
      const allowedItems = new Set(['skill_crystal','ability_core','power_chest','wooden_chest','silver_chest','golden_chest','operator_chest','special_operator_chest','latest_character_exchange_chest'])
      if (!allowedItems.has(itemId) || amount === null) return respond({ ok: false, error: 'Invalid item ID or amount' }, 400)
      const target = String(body.target || '')
      const ids = Array.isArray(body.targetIds) ? body.targetIds.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 100) : []
      if (['single','multiple'].includes(target) && (!ids.length || (target === 'single' && ids.length !== 1))) return respond({ ok: false, error: 'Invalid recipient list' }, 400)
      if (!['single','multiple','all','all_players','all_ai'].includes(target)) return respond({ ok: false, error: 'Invalid item recipient target' }, 400)
      const recipients: { kind: 'player'|'ai'; id: string|number }[] = []
      if (['all','all_players'].includes(target)) {
        const { data, error } = await client.from('player_rankings').select('player_id').limit(2000)
        if (error) return respond({ ok: false, error: 'Could not load player recipients' }, 500)
        for (const p of data || []) recipients.push({ kind: 'player', id: String(p.player_id) })
      }
      if (['all','all_ai'].includes(target)) {
        const { data, error } = await client.from('ai_accounts').select('account_id').limit(2000)
        if (error) return respond({ ok: false, error: 'Could not load AI recipients' }, 500)
        for (const a of data || []) recipients.push({ kind: 'ai', id: Number(a.account_id) })
      }
      if (['single','multiple'].includes(target)) {
        for (const ident of ids) {
          const ai = ident.match(/^AI[-_ ]?([0-9]{1,6})$/i)
          if (ai) {
            const accountId = Number(ai[1])
            const { data, error } = await client.from('ai_accounts').select('account_id').eq('account_id', accountId).maybeSingle()
            if (error) return respond({ ok: false, error: 'Could not resolve AI recipient' }, 500)
            if (data) recipients.push({ kind: 'ai', id: Number(data.account_id) })
            continue
          }
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ident)
          let query = client.from('player_rankings').select('player_id')
          query = isUuid ? query.eq('player_id', ident) : query.eq('name', ident)
          const { data, error } = await query.limit(1).maybeSingle()
          if (error) return respond({ ok: false, error: 'Could not resolve player recipient' }, 500)
          if (data) recipients.push({ kind: 'player', id: String(data.player_id) })
          else if (!isUuid) {
            const { data: aiData, error: aiError } = await client.from('ai_accounts').select('account_id').eq('name', ident).limit(1).maybeSingle()
            if (aiError) return respond({ ok: false, error: 'Could not resolve AI recipient' }, 500)
            if (aiData) recipients.push({ kind: 'ai', id: Number(aiData.account_id) })
          }
        }
      }
      const unique = [...new Map(recipients.map(r => [r.kind + ':' + r.id, r])).values()]
      if (!unique.length) return respond({ ok: false, error: 'No matching account found' }, 404)
      if (unique.length > 2000) return respond({ ok: false, error: 'Limit is 2,000 recipients per operation' }, 400)
      let grantedPlayers = 0, grantedAi = 0
      for (const recipient of unique) {
        if (recipient.kind === 'ai') {
          const { data: a, error } = await client.from('ai_accounts').select('inventory_items').eq('account_id', Number(recipient.id)).maybeSingle()
          if (error || !a) return respond({ ok: false, error: 'Item delivery stopped after ' + (grantedPlayers + grantedAi) + ' accounts' }, 500)
          const inventory = { ...(a.inventory_items && typeof a.inventory_items === 'object' && !Array.isArray(a.inventory_items) ? a.inventory_items : {}) } as Record<string, number>
          inventory[itemId] = Math.max(0, Number(inventory[itemId] || 0)) + amount
          const { error: updateError } = await client.from('ai_accounts').update({ inventory_items: inventory, updated_at: now }).eq('account_id', Number(recipient.id))
          if (updateError) return respond({ ok: false, error: 'Item delivery stopped after ' + (grantedPlayers + grantedAi) + ' accounts' }, 500)
          grantedAi++
        } else {
          const { data: p, error } = await client.from('player_rankings').select('operator_pending_items').eq('player_id', String(recipient.id)).maybeSingle()
          if (error || !p) return respond({ ok: false, error: 'Item delivery stopped after ' + (grantedPlayers + grantedAi) + ' accounts' }, 500)
          const inventory = { ...(p.operator_pending_items && typeof p.operator_pending_items === 'object' && !Array.isArray(p.operator_pending_items) ? p.operator_pending_items : {}) } as Record<string, number>
          inventory[itemId] = Math.max(0, Number(inventory[itemId] || 0)) + amount
          const { error: updateError } = await client.from('player_rankings').update({ operator_pending_items: inventory, operator_pending_items_ref: crypto.randomUUID(), updated_at: now }).eq('player_id', String(recipient.id))
          if (updateError) return respond({ ok: false, error: 'Item delivery stopped after ' + (grantedPlayers + grantedAi) + ' accounts' }, 500)
          grantedPlayers++
        }
      }
      return respond({ ok: true, action, itemId, amount, granted: grantedPlayers + grantedAi, grantedPlayers, grantedAi })
    }

    if (action === 'maintenance_stop') {
      const { error } = await client.from('world_operator_state').upsert({ id: 1, maintenance_active: false, updated_at: now, updated_by: OPERATOR_PLAYER_ID }, { onConflict: 'id' })
      if (error) return respond({ ok: false, error: 'Could not stop maintenance notice' }, 500)
      return respond({ ok: true, action })
    }

    if (action === 'player_lookup' || action === 'rp_adjust' || action === 'limited_character_grant') {
      const resolve = async (ident: string) => {
        const ai = ident.match(/^AI[-_ ]?([0-9]{1,6})$/i)
        if (ai) {
          const { data, error } = await client.from('ai_accounts').select('account_id,name,rp,wins,losses,limited_character_owned').eq('account_id', Number(ai[1])).maybeSingle()
          if (error) throw new Error('Could not resolve AI account')
          return data ? { kind: 'ai' as const, id: Number(data.account_id), name: String(data.name || ident), rp: Number(data.rp || 0), wins: Number(data.wins || 0), losses: Number(data.losses || 0), limited: Boolean(data.limited_character_owned) } : null
        }
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ident)
        let q = client.from('player_rankings').select('player_id,name,rp,wins,losses,limited_character_owned')
        q = isUuid ? q.eq('player_id', ident) : q.eq('name', ident)
        const { data, error } = await q.limit(1).maybeSingle()
        if (error) throw new Error('Could not resolve player account')
        if (data) return { kind: 'player' as const, id: String(data.player_id), name: String(data.name || ident), rp: Number(data.rp || 0), wins: Number(data.wins || 0), losses: Number(data.losses || 0), limited: Boolean(data.limited_character_owned) }
        if (!isUuid) {
          const { data: a, error: ae } = await client.from('ai_accounts').select('account_id,name,rp,wins,losses,limited_character_owned').eq('name', ident).limit(1).maybeSingle()
          if (ae) throw new Error('Could not resolve AI account')
          if (a) return { kind: 'ai' as const, id: Number(a.account_id), name: String(a.name || ident), rp: Number(a.rp || 0), wins: Number(a.wins || 0), losses: Number(a.losses || 0), limited: Boolean(a.limited_character_owned) }
        }
        return null
      }
      const input = String(body.accountId || body.playerId || '').trim()
      if (action === 'player_lookup') {
        if (!input) return respond({ ok: false, error: 'Account ID, AI number, or registered name is required' }, 400)
        const account = await resolve(input)
        if (!account) return respond({ ok: false, error: 'No matching account found' }, 404)
        return respond({ ok: true, action, accountType: account.kind === 'ai' ? 'AI' : 'プレイヤー', accountId: String(account.id), name: account.name, rp: account.rp, wins: account.wins, losses: account.losses, limitedCharacterOwned: account.limited })
      }
      const target = String(body.target || 'single')
      const ids = Array.isArray(body.targetIds) ? body.targetIds.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 100) : []
      if (!['single','multiple','all','all_players','all_ai'].includes(target)) return respond({ ok: false, error: 'Invalid account target' }, 400)
      const recipients: Awaited<ReturnType<typeof resolve>>[] = []
      if (target === 'single' || target === 'multiple') {
        const list = ids.length ? ids : input ? [input] : []
        if (!list.length || (target === 'single' && list.length !== 1)) return respond({ ok: false, error: 'Invalid recipient list' }, 400)
        for (const ident of list) {
          const account = await resolve(ident)
          if (account) recipients.push(account)
        }
      } else {
        if (target === 'all' || target === 'all_players') {
          const { data, error } = await client.from('player_rankings').select('player_id,name,rp,wins,losses,limited_character_owned').limit(2000)
          if (error) return respond({ ok: false, error: 'Could not load player recipients' }, 500)
          for (const p of data || []) recipients.push({ kind: 'player', id: String(p.player_id), name: String(p.name || ''), rp: Number(p.rp || 0), wins: Number(p.wins || 0), losses: Number(p.losses || 0), limited: Boolean(p.limited_character_owned) })
        }
        if (target === 'all' || target === 'all_ai') {
          const { data, error } = await client.from('ai_accounts').select('account_id,name,rp,wins,losses,limited_character_owned').limit(2000)
          if (error) return respond({ ok: false, error: 'Could not load AI recipients' }, 500)
          for (const a of data || []) recipients.push({ kind: 'ai', id: Number(a.account_id), name: String(a.name || ''), rp: Number(a.rp || 0), wins: Number(a.wins || 0), losses: Number(a.losses || 0), limited: Boolean(a.limited_character_owned) })
        }
      }
      const unique = [...new Map(recipients.filter((x): x is NonNullable<typeof x> => !!x).map(x => [x.kind + ':' + x.id, x])).values()]
      if (!unique.length) return respond({ ok: false, error: 'No matching account found' }, 404)
      if (unique.length > 2000) return respond({ ok: false, error: 'Limit is 2,000 recipients per operation' }, 400)
      const results: Record<string, unknown>[] = []
      if (action === 'rp_adjust') {
        const delta = integerInRange(body.delta, -100000, 100000)
        if (delta === null || delta === 0) return respond({ ok: false, error: 'RP change must be a non-zero integer from -100,000 to 100,000' }, 400)
      }
      for (const account of unique) {
        const patch: Record<string, unknown> = { updated_at: now }
        if (action === 'rp_adjust') patch.rp = Math.max(0, Math.min(2147483647, account.rp + Number(body.delta)))
        else patch.limited_character_owned = true
        const table = account.kind === 'ai' ? 'ai_accounts' : 'player_rankings'
        const key = account.kind === 'ai' ? 'account_id' : 'player_id'
        const { error } = await client.from(table).update(patch).eq(key, account.id)
        if (error) return respond({ ok: false, error: 'Operation stopped after ' + results.length + ' accounts' }, 500)
        results.push({ accountType: account.kind === 'ai' ? 'AI' : 'プレイヤー', name: account.name, rp: action === 'rp_adjust' ? patch.rp : account.rp, id: String(account.id) })
      }
      return respond({ ok: true, action, updated: results.length, results })
    }

    if (action === 'second_form_unlock') {
      const characterName = typeof body.characterName === 'string' ? body.characterName.trim() : ''
      const formName = typeof body.formName === 'string' ? body.formName.trim() : ''
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (!characterName || characterName.length > 100 || !formName || formName.length > 120 || !message || message.length > 300) return respond({ ok: false, error: 'Invalid second-form unlock settings' }, 400)
      const { data: current, error: readError } = await client.from('world_operator_state').select('second_form_unlocks').eq('id', 1).maybeSingle()
      if (readError) return respond({ ok: false, error: 'Could not load second-form unlocks' }, 500)
      const unlocks = Array.isArray(current?.second_form_unlocks) ? current.second_form_unlocks.filter((x: unknown) => x && typeof x === 'object') as Record<string, unknown>[] : []
      const next = [...unlocks.filter(x => String(x.characterName || '') !== characterName), { characterName, formName, message, unlockedAt: now }]
      const { error } = await client.from('world_operator_state').upsert({ id: 1, second_form_unlocks: next, second_form_unlock_character: characterName, second_form_unlock_form_name: formName, second_form_unlock_message: message, second_form_unlock_updated_at: now, updated_at: now, updated_by: OPERATOR_PLAYER_ID }, { onConflict: 'id' })
      if (error) return respond({ ok: false, error: 'Could not publish second-form unlock' }, 500)
      const { error: announceError } = await client.from('world_announcements').upsert({ id: 1, message, active: true, expires_at: new Date(Date.now() + 3600000).toISOString(), updated_at: now, updated_by: OPERATOR_PLAYER_ID }, { onConflict: 'id' })
      if (announceError) console.error('second form announcement failed:', announceError.message)
      return respond({ ok: true, action, characterName, formName })
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
      const { data: pendingDraws, error: pendingDrawError } = await client.from('world_lottery_draws').select('id,prizes').order('published_at', { ascending: false }).limit(50)
      if (pendingDrawError) return respond({ ok: false, error: 'Could not verify lottery status' }, 500)
      if ((pendingDraws || []).some((d: any) => ['announced', 'awarding'].includes(String(d?.prizes?._status || '')))) return respond({ ok: false, error: 'Lottery ticket issuance is paused until the announced draw is awarded' }, 409)
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
      const pickIndex = (max: number) => {
        const buf = new Uint32Array(1), limit = Math.floor(0x100000000 / max) * max
        do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
        return buf[0] % max
      }
      const pick = () => numbers[pickIndex(numbers.length)]
      const first = pick()
      const secondCandidates = [...new Set(numbers.map(n => n.slice(-4)))].filter(v => v !== first.slice(-4))
      const second: string[] = []
      while (second.length < 2 && secondCandidates.length) second.push(secondCandidates.splice(pickIndex(secondCandidates.length), 1)[0])
      const blockedThird = new Set([first.slice(-2), ...second.map(v => v.slice(-2))])
      const thirdCandidates = [...new Set(numbers.map(n => n.slice(-2)))].filter(v => !blockedThird.has(v))
      const third: string[] = []
      while (third.length < 10 && thirdCandidates.length) third.push(thirdCandidates.splice(pickIndex(thirdCandidates.length), 1)[0])
      if (second.length !== 2 || third.length !== 10) return respond({ ok: false, error: 'Not enough distinct ticket suffixes for the requested prize counts' }, 409)
      const fourth = pick()
      const rangeStart = Math.min(Number(fourth), 999900)
      return respond({ ok: true, action, winningNumbers: { '1': first, '2': second, '3': third, '4Start': String(rangeStart).padStart(6, '0'), '4End': String(rangeStart + 99).padStart(6, '0') } })
    }

    if (action === 'lottery_announce_numbers') {
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      const numbers = body.winningNumbers && typeof body.winningNumbers === 'object' ? body.winningNumbers : {}
      const first = String(numbers['1'] || '').replace(/[^0-9]/g, '')
      const parseList = (value: unknown, digits: number) => {
        const raw = Array.isArray(value) ? value : String(value || '').split(/[,，;；\\s]+/)
        return raw.map((v: unknown) => String(v || '').replace(/[^0-9]/g, '')).filter((v: string) => new RegExp('^[0-9]{' + digits + '}$').test(v))
      }
      const second = parseList(numbers['2'], 4), third = parseList(numbers['3'], 2)
      const overlaps = second.some((suffix: string) => suffix === first.slice(-4) || third.includes(suffix.slice(-2))) || new Set(second.map((suffix: string) => suffix.slice(-2))).size !== 2 || third.includes(first.slice(-2))
      if (!title || title.length > 60 || !/^[0-9]{6}$/.test(first) || second.length !== 2 || new Set(second).size !== 2 || third.length !== 10 || new Set(third).size !== 10 || overlaps) {
        return respond({ ok: false, error: 'Require non-overlapping 1st-3rd prize numbers: 1 six-digit number, 2 distinct four-digit suffixes, and 10 distinct two-digit suffixes' }, 400)
      }
      const { data: pendingDraws, error: pendingError } = await client.from('world_lottery_draws').select('id,prizes').order('published_at', { ascending: false }).limit(50)
      if (pendingError) return respond({ ok: false, error: 'Could not verify pending lottery draws' }, 500)
      if ((pendingDraws || []).some((d: any) => ['announced', 'awarding'].includes(String(d?.prizes?._status || '')))) return respond({ ok: false, error: 'A lottery draw is already announced and must be awarded first' }, 409)
      const { data: availableTickets, error: ticketsError } = await client.from('world_lottery_tickets').select('ticket_number').is('draw_id', null).limit(10000)
      if (ticketsError) return respond({ ok: false, error: 'Could not verify available tickets' }, 500)
      const availableNumbers = (availableTickets || []).map((t: any) => String(t.ticket_number || ''))
      if (!availableNumbers.includes(first) || second.some((suffix: string) => !availableNumbers.some((n: string) => n.slice(-4) === suffix)) || third.some((suffix: string) => !availableNumbers.some((n: string) => n.slice(-2) === suffix))) return respond({ ok: false, error: 'Every announced number must match at least one currently unclaimed ticket' }, 409)
      const winningNumbers = { '1': first, '2': second, '3': third }
      const { data: draw, error: drawError } = await client.from('world_lottery_draws').insert({ title, winning_number: first, prizes: { _status: 'announced', _winningNumbers: winningNumbers }, published_by: OPERATOR_PLAYER_ID }).select('id').single()
      if (drawError || !draw) return respond({ ok: false, error: 'Could not lock announced lottery numbers' }, 500)
      const announcement = '📣 🎟️ ' + title + ' 先行発表！ 1等 ' + first + '（1口）／2等 下4桁 ' + second.join('・') + '（2口）／3等 下2桁 ' + third.join('・') + '（10口）。これは番号の先行発表です。報酬の抽選・配布はまだ行われていません。'
      const { error } = await client.from('world_announcements').upsert({ id: 1, message: announcement, active: true, expires_at: new Date(Date.now() + 3600000).toISOString(), updated_at: now, updated_by: OPERATOR_PLAYER_ID }, { onConflict: 'id' })
      if (error) return respond({ ok: false, error: 'Numbers are locked, but the announcement could not be published' }, 500)
      return respond({ ok: true, action, title, drawId: draw.id, winningNumbers, rewardGranted: false })
    }

    if (action === 'lottery_publish') {
      const { data: recentDraws, error: recentDrawError } = await client.from('world_lottery_draws').select('id,title,winning_number,prizes').order('published_at', { ascending: false }).limit(50)
      if (recentDrawError) return respond({ ok: false, error: 'Could not check pending lottery draws' }, 500)
      if ((recentDraws || []).some((d: any) => d?.prizes?._status === 'awarding')) return respond({ ok: false, error: 'A lottery draw is already being processed. Do not start another draw; check the existing draw status first.' }, 409)
      const pendingDraw: any = (recentDraws || []).find((d: any) => d?.prizes?._status === 'announced') || null
      const title = pendingDraw ? String(pendingDraw.title || '') : (typeof body.title === 'string' ? body.title.trim() : '')
      const input = body.prizes && typeof body.prizes === 'object' ? body.prizes : {}
      const allowed = ['coins', 'xp', 'item', 'character', 'limited_character']
      const items = ['power_chest', 'wooden_chest', 'silver_chest', 'golden_chest', 'skill_crystal', 'ability_core', 'operator_chest', 'special_operator_chest']
      const legacyMode = pendingDraw ? false : !(body.winningNumbers && typeof body.winningNumbers === 'object')
      const requestedNumbers = body.winningNumbers && typeof body.winningNumbers === 'object' ? body.winningNumbers : {}
      const suppliedNumbers = pendingDraw ? { ...requestedNumbers, ...(pendingDraw.prizes?._winningNumbers || {}) } : requestedNumbers
      const legacyNumber = String(body.winningNumber || '').replace(/[^0-9]/g, '')
      const parseList = (value: unknown, digits: number, fallback: string) => {
        const raw = Array.isArray(value) ? value : value ? String(value).split(/[,，;；\\s]+/) : [fallback]
        return raw.map((v: unknown) => String(v || '').replace(/[^0-9]/g, '')).filter((v: string) => new RegExp('^[0-9]{' + digits + '}$').test(v))
      }
      const winningNumbers = {
        '1': String(suppliedNumbers['1'] || legacyNumber).replace(/[^0-9]/g, ''),
        '2': parseList(suppliedNumbers['2'], 4, legacyNumber.slice(-4)),
        '3': parseList(suppliedNumbers['3'], 2, legacyNumber.slice(-2)),
        '4Start': String(suppliedNumbers['4Start'] || (legacyMode ? '999900' : '')).replace(/[^0-9]/g, ''),
        '4End': String(suppliedNumbers['4End'] || (legacyMode ? '999999' : '')).replace(/[^0-9]/g, '')
      }
      const expectedSecondCount = legacyMode ? 1 : 2
      const expectedThirdCount = legacyMode ? 1 : 10
      const invalidHierarchy = !legacyMode && (new Set(winningNumbers['2'].map((suffix: string) => suffix.slice(-2))).size !== winningNumbers['2'].length || winningNumbers['2'].some((suffix: string) => suffix === winningNumbers['1'].slice(-4) || winningNumbers['3'].includes(suffix.slice(-2))) || winningNumbers['3'].includes(winningNumbers['1'].slice(-2)))
      if (!title || title.length > 60 || !/^[0-9]{6}$/.test(winningNumbers['1']) || winningNumbers['2'].length !== expectedSecondCount || new Set(winningNumbers['2']).size !== expectedSecondCount || winningNumbers['3'].length !== expectedThirdCount || new Set(winningNumbers['3']).size !== expectedThirdCount || invalidHierarchy || !/^[0-9]{6}$/.test(winningNumbers['4Start']) || !/^[0-9]{6}$/.test(winningNumbers['4End']) || Number(winningNumbers['4End']) - Number(winningNumbers['4Start']) !== 99) {
        return respond({ ok: false, error: 'Invalid winning numbers or 100-number fourth-prize range' }, 400)
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
      const storedPrizes = { ...prizes, _winningNumbers: winningNumbers, _status: 'awarding' }
      let draw: any = pendingDraw
      if (pendingDraw) {
        const { data: availableTickets, error: availableError } = await client.from('world_lottery_tickets').select('ticket_number').is('draw_id', null).limit(10000)
        if (availableError) return respond({ ok: false, error: 'Could not verify available tickets' }, 500)
        const availableNumbers = (availableTickets || []).map((t: any) => String(t.ticket_number || ''))
        if (!availableNumbers.includes(winningNumbers['1']) || winningNumbers['2'].some((suffix: string) => !availableNumbers.some((n: string) => n.slice(-4) === suffix)) || winningNumbers['3'].some((suffix: string) => !availableNumbers.some((n: string) => n.slice(-2) === suffix))) return respond({ ok: false, error: 'The announced numbers no longer match available tickets; no rewards were distributed' }, 409)
        const { error: updateDrawError } = await client.from('world_lottery_draws').update({ title, winning_number: winningNumbers['1'], prizes: storedPrizes }).eq('id', pendingDraw.id)
        if (updateDrawError) return respond({ ok: false, error: 'Could not lock the announced draw for awarding' }, 500)
      } else {
        const { data: createdDraw, error: createDrawError } = await client.from('world_lottery_draws').insert({ title, winning_number: winningNumbers['1'], prizes: storedPrizes, published_by: OPERATOR_PLAYER_ID }).select('id').single()
        if (createDrawError || !createdDraw) return respond({ ok: false, error: 'Could not create draw' }, 500)
        draw = createdDraw
      }
      const { data: tickets, error: te } = await client.from('world_lottery_tickets').select('id,ticket_number,owner_type,owner_id,owner_name').is('draw_id', null).order('created_at', { ascending: true }).limit(10000)
      if (te) return respond({ ok: false, error: 'Could not load tickets' }, 500)
      const buckets: Record<string, any[]> = { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], none: [] }
      const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 }
      const rangeStart = Number(winningNumbers['4Start']), rangeEnd = Number(winningNumbers['4End'])
      const drawRandomIndex = (max: number): number => {
        const buf = new Uint32Array(1), limit = Math.floor(0x100000000 / max) * max
        do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
        return buf[0] % max
      }
      const allTickets = tickets || []
      const assigned = new Set<string>()
      for (const t of allTickets) {
        if (String(t.ticket_number || '') === winningNumbers['1']) {
          buckets['1'].push(t)
          assigned.add(String(t.id))
        }
      }
      const secondCandidates = allTickets.filter((t: any) => !assigned.has(String(t.id)) && winningNumbers['2'].includes(String(t.ticket_number || '').slice(-4)))
      for (let i = 0; i < Math.min(2, secondCandidates.length); i++) {
        const winner = secondCandidates.splice(drawRandomIndex(secondCandidates.length), 1)[0]
        buckets['2'].push(winner)
        assigned.add(String(winner.id))
      }
      const thirdCandidates = allTickets.filter((t: any) => !assigned.has(String(t.id)) && winningNumbers['3'].includes(String(t.ticket_number || '').slice(-2)))
      for (let i = 0; i < Math.min(10, thirdCandidates.length); i++) {
        const winner = thirdCandidates.splice(drawRandomIndex(thirdCandidates.length), 1)[0]
        buckets['3'].push(winner)
        assigned.add(String(winner.id))
      }
      if (!legacyMode) {
        for (const t of allTickets) {
          const n = String(t.ticket_number || ''), numeric = Number(n)
          if (!assigned.has(String(t.id)) && numeric >= rangeStart && numeric <= rangeEnd) {
            buckets['4'].push(t)
            assigned.add(String(t.id))
          }
        }
      }
      const lowerPrizeCandidates = allTickets.filter((t: any) => !assigned.has(String(t.id)))
      for (const tier of ['5', '6']) {
        if (lowerPrizeCandidates.length) {
          const winner = lowerPrizeCandidates.splice(drawRandomIndex(lowerPrizeCandidates.length), 1)[0]
          buckets[tier].push(winner)
          assigned.add(String(winner.id))
        }
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
      const { error: completeDrawError } = await client.from('world_lottery_draws').update({ prizes: { ...prizes, _winningNumbers: winningNumbers, _status: 'awarded' }, ticket_count: (tickets || []).length, winner_counts: counts, awarded_count: awarded }).eq('id', draw.id)
      if (completeDrawError) return respond({ ok: false, error: 'Rewards were processed but the draw completion state could not be saved; manual reconciliation is required', drawId: draw.id, awarded }, 500)
      const announcement = legacyMode
        ? '🎟️ ' + title + ' 当選発表！番号 ' + winningNumbers['1'].slice(0, 2) + '-' + winningNumbers['1'].slice(2) + '／1等6桁・2等下4桁・3等下2桁一致。5・6等は残りチケットから各1口を抽選、その他は7等参加賞。アイテムバッグで確認してください。'
        : '🎟️ ' + title + ' 当選発表！ 1等 ' + winningNumbers['1'] + '（1口）／2等 下4桁 ' + winningNumbers['2'] + '（最大2口）／3等 下2桁 ' + winningNumbers['3'] + '（最大10口）／4等 ' + winningNumbers['4Start'] + '〜' + winningNumbers['4End'] + '。2・3等は該当候補から上限口数までランダム選出。5・6等は1〜4等に外れたチケットから各1口をランダム抽選、残りは7等参加賞です。アイテムバッグで確認してください。'
      const { error: resultAnnouncementError } = await client.from('world_announcements').upsert({ id: 1, message: announcement, active: true, expires_at: new Date(Date.now() + 3600000).toISOString(), updated_at: now, updated_by: OPERATOR_PLAYER_ID }, { onConflict: 'id' })
      if (resultAnnouncementError) return respond({ ok: false, error: 'Draw was awarded but the public result announcement could not be saved', drawId: draw.id, awarded }, 500)
      return respond({ ok: true, action, title, drawId: draw.id, winners: Object.values(counts).reduce((sum, count) => sum + count, 0), prizeCounts: counts, awarded })
    }
    return respond({ ok: false, error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('operator handler failed:', error instanceof Error ? error.message : 'unknown error')
    return respond({ ok: false, error: 'Server error while processing operator command' }, 500)
  }
})
