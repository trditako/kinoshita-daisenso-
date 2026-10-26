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
      // Two tabs can request the first wallet simultaneously. Ignore a duplicate
      // insert, then read the canonical row instead of returning a spurious 500.
      const { error: createError } = await admin.from('trade_profiles')
        .upsert({ user_id: userId, display_name: displayName }, {
          onConflict: 'user_id',
          ignoreDuplicates: true,
        })
      if (createError) throw createError
      const { data, error: finalReadError } = await admin.from('trade_profiles')
        .select('user_id,coins,xp,inventory,cosmetics,updated_at')
        .eq('user_id', userId).single()
      if (finalReadError) throw finalReadError
      return response({ ok: true, profile: data })
    }

    if (action === 'claim_daily_login') {
      // The trade profile is not yet bound to a verified game account. Awarding
      // rewards here would mint transferable trade balances for an unrelated
      // anonymous account. Keep the RPC unreachable until account linking and
      // the canonical game wallet are implemented end-to-end.
      return response({ ok: false, error: 'GAME_ACCOUNT_LINK_REQUIRED' }, 409)
    }

    return response({ ok: false, error: 'UNKNOWN_ACTION' }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('game-wallet error', message)
    return response({ ok: false, error: 'SERVER_ERROR' }, 500)
  }
})
