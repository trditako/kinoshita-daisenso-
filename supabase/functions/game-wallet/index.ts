import { createClient } from 'npm:@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL') || ''
const RAW = Deno.env.get('SUPABASE_SECRET_KEYS') || ''
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors })
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}

function serviceKey() {
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!key && RAW) {
    try { key = String((JSON.parse(RAW) as Record<string, unknown>).default || '') } catch { /* validated below */ }
  }
  if (!URL || !key) throw new Error('SERVER_CONFIGURATION_MISSING')
  return key
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return response({ ok: false, error: 'POST_ONLY' }, 405)
  try {
    const token = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return response({ ok: false, error: 'AUTH_REQUIRED' }, 401)
    const admin = createClient(URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) return response({ ok: false, error: 'INVALID_SESSION' }, 401)

    const body = object(await req.json())
    const action = String(body.action || '')
    const userId = authData.user.id

    if (action === 'wallet') {
      const displayName = 'プレイヤー'
      const { data: existing, error: readError } = await admin.from('trade_profiles')
        .select('user_id,coins,xp,inventory,cosmetics,updated_at')
        .eq('user_id', userId).maybeSingle()
      if (readError) throw readError
      if (existing) return response({ ok: true, profile: existing })
      const { data, error } = await admin.from('trade_profiles')
        .insert({ user_id: userId, display_name: displayName })
        .select('user_id,coins,xp,inventory,cosmetics,updated_at').single()
      if (error) throw error
      return response({ ok: true, profile: data })
    }

    if (action === 'claim_daily_login') {
      const { data, error } = await admin.rpc('claim_game_daily_login', { p_user_id: userId })
      if (error) {
        const message = String(error.message || '')
        if (message.includes('INVALID_USER')) return response({ ok: false, error: 'INVALID_USER' }, 400)
        throw error
      }
      return response({ ok: true, result: data })
    }

    return response({ ok: false, error: 'UNKNOWN_ACTION' }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('game-wallet error', message)
    return response({ ok: false, error: 'SERVER_ERROR' }, 500)
  }
})
