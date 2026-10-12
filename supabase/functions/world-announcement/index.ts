import { createClient } from 'npm:@supabase/supabase-js@2'

const OPERATOR_PLAYER_ID = 'cd19b245-1a70-45de-9bb7-967f6c568425'
const URL = Deno.env.get('SUPABASE_URL') || ''
const TOKEN = Deno.env.get('WORLD_ANNOUNCEMENT_TOKEN') || ''
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
  if (!key && RAW_SECRET_KEYS) {
    try {
      const keys = JSON.parse(RAW_SECRET_KEYS)
      key = String(keys.default || '')
    } catch {
      throw new Error('Unable to read Supabase server key configuration')
    }
  }
  if (!key) throw new Error('Supabase server key is not configured')
  db = createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return db
}

function safeEqual(a: string, b: string) {
  const encoder = new TextEncoder()
  const aa = encoder.encode(a)
  const bb = encoder.encode(b)
  if (aa.length !== bb.length) return false
  let difference = 0
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i]
  return difference === 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respond({ ok: false, error: 'POST only' }, 405)
  if (!TOKEN) return respond({ ok: false, error: 'Server operator token is not configured' }, 503)
  const suppliedToken = req.headers.get('x-operator-broadcast-token') || ''
  if (!safeEqual(suppliedToken, TOKEN)) return respond({ ok: false, error: 'Operator authentication failed' }, 401)

  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || body.operatorId !== OPERATOR_PLAYER_ID) {
      return respond({ ok: false, error: 'Operator account check failed' }, 403)
    }
    const action = String(body.action || '')
    const now = new Date().toISOString()
    let row: Record<string, unknown>

    if (action === 'publish') {
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      const durationSeconds = Number(body.durationSeconds)
      const allowedDurations = new Set([30, 60, 300, 600, 1800, 3600])
      if (!message) return respond({ ok: false, error: 'Message is required' }, 400)
      if (message.length > 300) return respond({ ok: false, error: 'Message must be 300 characters or fewer' }, 400)
      if (!allowedDurations.has(durationSeconds)) return respond({ ok: false, error: 'Invalid announcement duration' }, 400)
      row = {
        id: 1,
        message,
        active: true,
        expires_at: new Date(Date.now() + durationSeconds * 1000).toISOString(),
        updated_at: now,
        updated_by: OPERATOR_PLAYER_ID,
      }
    } else if (action === 'clear') {
      row = {
        id: 1,
        message: '',
        active: false,
        expires_at: null,
        updated_at: now,
        updated_by: OPERATOR_PLAYER_ID,
      }
    } else {
      return respond({ ok: false, error: 'Unknown action' }, 400)
    }

    const { error } = await getDb().from('world_announcements').upsert(row, { onConflict: 'id' })
    if (error) {
      console.error('world announcement write failed:', error.message)
      return respond({ ok: false, error: 'Announcement could not be saved' }, 500)
    }
    return respond({ ok: true, action, expiresAt: row.expires_at || null })
  } catch (error) {
    console.error('world announcement handler failed:', error instanceof Error ? error.message : 'unknown error')
    return respond({ ok: false, error: 'Server error while processing announcement' }, 500)
  }
})
