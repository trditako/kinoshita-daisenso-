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
const int = (v: unknown, max = 1_000_000_000) => {
  const n = Number(v)
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new Error('INVALID_ASSET_AMOUNT')
  return n
}
function serviceKey() {
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!key && RAW) {
    try { key = String((JSON.parse(RAW) as Record<string, unknown>).default || '') } catch { /* checked below */ }
  }
  if (!URL || !key) throw new Error('SERVER_CONFIGURATION_MISSING')
  return key
}
function cleanAssets(input: unknown) {
  const a = object(input)
  const itemsIn = object(a.items)
  const cosmeticsIn = object(a.cosmetics)
  const items: Record<string, number> = {}
  const cosmetics: Record<string, number> = {}
  for (const [id, qty] of Object.entries(itemsIn)) {
    if (id.length < 1 || id.length > 100 || /[\\u0000-\\u001f]/.test(id)) throw new Error('INVALID_ITEM_ID')
    const n = int(qty, 100_000)
    if (n > 0) items[id] = n
  }
  for (const [id, qty] of Object.entries(cosmeticsIn)) {
    if (id.length < 1 || id.length > 120 || /[\\u0000-\\u001f]/.test(id)) throw new Error('INVALID_COSMETIC_ID')
    if (int(qty, 1) !== 1) throw new Error('COSMETICS_MUST_BE_UNIQUE')
    cosmetics[id] = 1
  }
  const assets = { coins: int(a.coins ?? 0), xp: int(a.xp ?? 0), items, cosmetics }
  if (!assets.coins && !assets.xp && !Object.keys(items).length && !Object.keys(cosmetics).length) throw new Error('EMPTY_TRADE_ASSETS')
  return assets
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return response({ ok: false, error: 'POST_ONLY' }, 405)
  try {
    const authorization = req.headers.get('authorization') || ''
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return response({ ok: false, error: 'AUTH_REQUIRED' }, 401)
    const admin = createClient(URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) return response({ ok: false, error: 'INVALID_SESSION' }, 401)
    const userId = authData.user.id
    const body = object(await req.json())
    const action = String(body.action || '')
    if (action === 'profile') {
      const displayName = String(body.display_name || 'プレイヤー').trim().slice(0, 32) || 'プレイヤー'
      const playerId = typeof body.player_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.player_id) ? body.player_id : null
      const { data: existing, error: readError } = await admin.from('trade_profiles').select('*').eq('user_id', userId).maybeSingle()
      if (readError) throw readError
      if (!existing) {
        const { data, error } = await admin.from('trade_profiles').insert({ user_id: userId, player_id: playerId, display_name: displayName }).select('*').single()
        if (error) throw error
        return response({ ok: true, profile: data })
      }
      const { data, error } = await admin.from('trade_profiles').update({ display_name: displayName, player_id: existing.player_id || playerId, updated_at: new Date().toISOString() }).eq('user_id', userId).select('*').single()
      if (error) throw error
      return response({ ok: true, profile: data })
    }
    if (action === 'list') {
      const { data, error } = await admin.from('trade_offers')
        .select('id,seller_id,buyer_id,offered_assets,requested_assets,status,created_at,expires_at')
        .eq('status', 'open').gt('expires_at', new Date().toISOString())
        .or(`seller_id.eq.${userId},buyer_id.eq.${userId},buyer_id.is.null`)
        .order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return response({ ok: true, offers: data || [] })
    }
    if (action === 'create_offer') {
      const offered = cleanAssets(body.offered_assets)
      const requested = cleanAssets(body.requested_assets)
      const buyerId = typeof body.buyer_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.buyer_id) ? body.buyer_id : null
      if (buyerId === userId) return response({ ok: false, error: 'CANNOT_TRADE_WITH_SELF' }, 400)
      const { data: profile, error: profileError } = await admin.from('trade_profiles').select('*').eq('user_id', userId).single()
      if (profileError || !profile) return response({ ok: false, error: 'PROFILE_REQUIRED' }, 400)
      const { count: activeOffers, error: countError } = await admin.from('trade_offers').select('id', { count: 'exact', head: true }).eq('seller_id', userId).eq('status', 'open').gt('expires_at', new Date().toISOString())
      if (countError) throw countError
      if ((activeOffers || 0) >= 10) return response({ ok: false, error: 'ACTIVE_OFFER_LIMIT' }, 429)
      if (Number(profile.coins) < offered.coins || Number(profile.xp) < offered.xp) return response({ ok: false, error: 'INSUFFICIENT_CURRENCY' }, 400)
      for (const [id, qty] of Object.entries(offered.items)) if (Number(profile.inventory?.[id] || 0) < qty) return response({ ok: false, error: 'INSUFFICIENT_ITEM', item_id: id }, 400)
      for (const id of Object.keys(offered.cosmetics)) if (Number(profile.cosmetics?.[id] || 0) < 1) return response({ ok: false, error: 'INSUFFICIENT_COSMETIC', item_id: id }, 400)
      const { data, error } = await admin.from('trade_offers').insert({ seller_id: userId, buyer_id: buyerId, offered_assets: offered, requested_assets: requested }).select('*').single()
      if (error) throw error
      return response({ ok: true, offer: data })
    }
    if (action === 'accept') {
      const offerId = String(body.offer_id || '')
      if (!/^[0-9a-f-]{36}$/i.test(offerId)) return response({ ok: false, error: 'INVALID_OFFER_ID' }, 400)
      const { data, error } = await admin.rpc('settle_trade', { p_offer_id: offerId, p_actor: userId })
      if (error) {
        const message = String(error.message || '')
        const known = ['TRADE_NOT_FOUND','TRADE_NOT_OPEN','TRADE_EXPIRED','CANNOT_ACCEPT_OWN_TRADE','TRADE_NOT_FOR_YOU','TRADE_PROFILE_MISSING','INVALID_ASSET_AMOUNT','INSUFFICIENT_CURRENCY']
        return response({ ok: false, error: known.find(k => message.includes(k)) || (message.startsWith('INSUFFICIENT_') ? message.split(':')[0] : 'TRADE_FAILED') }, 400)
      }
      return response({ ok: true, result: data })
    }
    if (action === 'cancel') {
      const offerId = String(body.offer_id || '')
      if (!/^[0-9a-f-]{36}$/i.test(offerId)) return response({ ok: false, error: 'INVALID_OFFER_ID' }, 400)
      const { data, error } = await admin.from('trade_offers').update({ status: 'cancelled' }).eq('id', offerId).eq('seller_id', userId).eq('status', 'open').select('id').maybeSingle()
      if (error) throw error
      if (!data) return response({ ok: false, error: 'CANNOT_CANCEL_TRADE' }, 400)
      return response({ ok: true })
    }
    return response({ ok: false, error: 'UNKNOWN_ACTION' }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('INVALID_') || message.includes('EMPTY_TRADE') || message.includes('COSMETICS_MUST')) return response({ ok: false, error: message }, 400)
    console.error('trade-api error', message)
    return response({ ok: false, error: 'SERVER_ERROR' }, 500)
  }
})
