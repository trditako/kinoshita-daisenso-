import { createClient } from 'npm:@supabase/supabase-js@2'

const OPERATOR_PLAYER_ID = 'cd19b245-1a70-45de-9bb7-967f6c568425'
const URL = Deno.env.get('SUPABASE_URL') || ''
const RAW_SECRET_KEYS = Deno.env.get('SUPABASE_SECRET_KEYS') || ''
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
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
  const authorization = req.headers.get('authorization') || ''
  const accessToken = authorization.match(/^Bearer\\s+(.+)$/i)?.[1] || ''
  if (!accessToken) return respond({ ok: false, error: 'Supabase Auth login required' }, 401)
  const allowedOperatorAuthId = Deno.env.get('WORLD_OPERATOR_AUTH_USER_ID') || ''
  if (!allowedOperatorAuthId) return respond({ ok: false, error: 'Operator Auth user ID is not configured' }, 503)

  try {
    const client = getDb()
    const { data: authData, error: authError } = await client.auth.getUser(accessToken)
    if (authError || !authData.user) return respond({ ok: false, error: 'Supabase Auth session is invalid or expired' }, 401)
    if (authData.user.id !== allowedOperatorAuthId) return respond({ ok: false, error: 'This account is not authorized for operator actions' }, 403)
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
    return respond({ ok: false, error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('operator handler failed:', error instanceof Error ? error.message : 'unknown error')
    return respond({ ok: false, error: 'Server error while processing operator command' }, 500)
  }
})
