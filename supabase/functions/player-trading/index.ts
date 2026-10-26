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
    if (id.length < 1 || id.length > 100 || /[\x00-\x1f]/.test(id)) throw new Error('INVALID_ITEM_ID')
    const n = int(qty, 100_000)
    if (n > 0) items[id] = n
  }
  for (const [id, qty] of Object.entries(cosmeticsIn)) {
    if (id.length < 1 || id.length > 120 || /[\x00-\x1f]/.test(id)) throw new Error('INVALID_COSMETIC_ID')
    const n = int(qty, 100_000)
    if (n > 0) cosmetics[id] = n
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
      // A client-supplied local ranking ID is not proof of ownership. Keep the
      // profile unlinked until a server-verified account-link challenge exists.
      const { data: existing, error: readError } = await admin.from('trade_profiles').select('*').eq('user_id', userId).maybeSingle()
      if (readError) throw readError
      if (!existing) {
        const { data, error } = await admin.from('trade_profiles').insert({ user_id: userId, player_id: null, display_name: displayName }).select('*').single()
        if (error) throw error
        return response({ ok: true, profile: data })
      }
      const { data, error } = await admin.from('trade_profiles').update({ display_name: displayName }).eq('user_id', userId).select('*').single()
      if (error) throw error
      return response({ ok: true, profile: data })
    }
    if (action === 'sync_wallet') {
      const snapshot = object(body.snapshot)
      const coins = int(snapshot.coins ?? 0)
      const xp = int(snapshot.xp ?? 0)
      const itemsIn = object(snapshot.items)
      const cosmeticsIn = object(snapshot.cosmetics)
      const items: Record<string, number> = {}
      const cosmetics: Record<string, number> = {}
      for (const [id, qty] of Object.entries(itemsIn)) {
        if (!id || id.length > 100) throw new Error('INVALID_ITEM_ID')
        const n = int(qty, 100_000)
        if (n > 0) items[id] = n
      }
      for (const [id, qty] of Object.entries(cosmeticsIn)) {
        if (!id || id.length > 120) throw new Error('INVALID_COSMETIC_ID')
        const n = int(qty, 100_000)
        if (n > 0) cosmetics[id] = n
      }
      const { data: current, error: currentError } = await admin.from('trade_profiles').select('*').eq('user_id', userId).maybeSingle()
      if (currentError) throw currentError
      if (!current) return response({ ok: false, error: 'TRADE_PROFILE_MISSING' }, 404)
      if (!current.game_assets_synced_at) {
        const { data: synced, error: syncError } = await admin.from('trade_profiles')
          .update({ coins, xp, inventory: items, cosmetics, game_assets_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('user_id', userId).is('game_assets_synced_at', null).select('*').maybeSingle()
        if (syncError) throw syncError
        if (synced) return response({ ok: true, imported: true, profile: synced })
      }
      const { data: latest, error: latestError } = await admin.from('trade_profiles').select('*').eq('user_id', userId).single()
      if (latestError) throw latestError
      return response({ ok: true, imported: false, profile: latest })
    }
    if (action === 'ledger') {
      const { data, error } = await admin.from('trade_asset_ledger')
        .select('id,asset_type,asset_id,delta,balance_after,source,created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return response({ ok: true, entries: data || [] })
    }
    if (action === 'market_stats') {
      // Demand index from recent completed player and AI trades. Requested assets
      // count as demand; offered assets count as supply. Only aggregate counts leave the server.
      const [{ data: playerTrades, error: playerTradeError }, { data: aiTrades, error: aiTradeError }] = await Promise.all([
        admin.from('trade_history').select('offered_assets,requested_assets,completed_at').order('completed_at', { ascending: false }).limit(500),
        admin.from('ai_trade_offers').select('offered_assets,requested_assets,created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(500),
      ])
      if (playerTradeError) throw playerTradeError
      if (aiTradeError) throw aiTradeError
      const stats: Record<string, Record<string, { demand: number; supply: number }>> = { items: {}, cosmetics: {} }
      const add = (kind: 'items' | 'cosmetics', id: string, side: 'demand' | 'supply') => {
        if (!id || id.length > 120) return
        const row = (stats[kind] as any)[id] || { demand: 0, supply: 0 }
        row[side]++
        ;(stats[kind] as any)[id] = row
      }
      const scan = (trade: any) => {
        const offered = object(trade.offered_assets), requested = object(trade.requested_assets)
        for (const [id, qty] of Object.entries(object(offered.items))) if (int(qty) > 0) add('items', id, 'supply')
        for (const [id, qty] of Object.entries(object(requested.items))) if (int(qty) > 0) add('items', id, 'demand')
        for (const [id, owned] of Object.entries(object(offered.cosmetics))) if (owned === true || int(owned) > 0) add('cosmetics', id, 'supply')
        for (const [id, owned] of Object.entries(object(requested.cosmetics))) if (owned === true || int(owned) > 0) add('cosmetics', id, 'demand')
      }
      for (const trade of [...(playerTrades || []), ...(aiTrades || [])]) scan(trade)
      const normalized: Record<string, Record<string, number>> = { items: {}, cosmetics: {} }
      for (const kind of ['items', 'cosmetics'] as const) {
        for (const [id, row] of Object.entries(stats[kind]) as [string, { demand: number; supply: number }][]) {
          // Demand-to-supply ratio adjusts the base estimate; cap the multiplier to avoid extreme swings.
          normalized[kind][id] = Math.max(0.65, Math.min(2.5, 0.8 + Math.log1p(row.demand) * 0.35 - Math.log1p(row.supply) * 0.12))
        }
      }
      return response({ ok: true, stats: normalized, sample_size: (playerTrades || []).length + (aiTrades || []).length })
    }
    if (action === 'market_stats') {
      // Aggregate completed trades into a bounded demand/supply index.
      const [{ data: playerTrades, error: playerTradeError }, { data: aiTrades, error: aiTradeError }] = await Promise.all([
        admin.from('trade_history').select('offered_assets,requested_assets,completed_at').order('completed_at', { ascending: false }).limit(500),
        admin.from('ai_trade_offers').select('offered_assets,requested_assets,created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(500),
      ])
      if (playerTradeError) throw playerTradeError
      if (aiTradeError) throw aiTradeError
      const stats: Record<string, Record<string, { demand: number; supply: number }>> = { items: {}, cosmetics: {} }
      const add = (kind: 'items' | 'cosmetics', id: string, side: 'demand' | 'supply') => {
        if (!id || id.length > 120) return
        const row = (stats[kind] as any)[id] || { demand: 0, supply: 0 }
        row[side]++
        ;(stats[kind] as any)[id] = row
      }
      const scan = (trade: any) => {
        const offered = object(trade.offered_assets), requested = object(trade.requested_assets)
        for (const [id, qty] of Object.entries(object(offered.items))) if (int(qty) > 0) add('items', id, 'supply')
        for (const [id, qty] of Object.entries(object(requested.items))) if (int(qty) > 0) add('items', id, 'demand')
        for (const [id, qty] of Object.entries(object(offered.cosmetics))) if (qty === true || int(qty) > 0) add('cosmetics', id, 'supply')
        for (const [id, qty] of Object.entries(object(requested.cosmetics))) if (qty === true || int(qty) > 0) add('cosmetics', id, 'demand')
      }
      for (const trade of [...(playerTrades || []), ...(aiTrades || [])]) scan(trade)
      const normalized: Record<string, Record<string, number>> = { items: {}, cosmetics: {} }
      for (const kind of ['items', 'cosmetics'] as const) {
        for (const [id, row] of Object.entries(stats[kind]) as [string, { demand: number; supply: number }][]) {
          normalized[kind][id] = Math.max(0.65, Math.min(2.5, 0.8 + Math.log1p(row.demand) * 0.35 - Math.log1p(row.supply) * 0.12))
        }
      }
      const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, 2500) : []
      const fixed: Record<string, number> = {
        normal_gold: 250, power_chest: 1200, golden_chest: 2400, ability_core: 1800,
        ancient_power: 900, latest_character_exchange_chest: 30000,
        'rarity_gold:ノーマル': 300, 'rarity_gold:レア': 600, 'rarity_gold:激レア': 1200,
        'rarity_gold:超激レア': 6000, 'rarity_gold:伝説レア': 18000,
      }
      const rarityBase: Record<string, number> = { 'ノーマル': 500, 'レア': 1500, '激レア': 4000, '超激レア': 12000, '伝説レア': 30000 }
      const snapshotDate = new Date().toISOString().slice(0, 10)
      const snapshots = []
      for (const entry of catalog) {
        const row = object(entry), kind = String(row.kind || ''), id = String(row.id || '')
        if (!['item', 'cosmetic'].includes(kind) || !id || id.length > 120 || /[\\x00-\\x1f]/.test(id)) continue
        const bucket = kind === 'item' ? 'items' : 'cosmetics'
        const multiplier = normalized[bucket][id] ?? 1
        const rarity = String(row.rarity || '')
        const base = kind === 'item' ? (fixed[id] ?? fixed[id.toLowerCase()] ?? 150) : (rarityBase[rarity] ?? 5000)
        snapshots.push({ asset_type: kind, asset_id: id, snapshot_date: snapshotDate, estimated_value: Math.max(1, Math.round(base * multiplier)), demand_multiplier: multiplier })
      }
      if (snapshots.length) {
        const { error: snapshotError } = await admin.from('bazaar_price_history').upsert(snapshots, { onConflict: 'asset_type,asset_id,snapshot_date' })
        if (snapshotError) throw snapshotError
      }
      const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
      const { data: priceHistory, error: historyError } = await admin.from('bazaar_price_history')
        .select('asset_type,asset_id,snapshot_date,estimated_value,demand_multiplier')
        .gte('snapshot_date', since).order('snapshot_date', { ascending: true }).limit(5000)
      if (historyError) throw historyError
      return response({ ok: true, stats: normalized, price_history: priceHistory || [], sample_size: (playerTrades || []).length + (aiTrades || []).length })
    }
    if (action === 'list') {
      const { data, error } = await admin.from('trade_offers')
        .select('id,seller_id,buyer_id,offered_assets,requested_assets,status,created_at,expires_at')
        .eq('status', 'open').gt('expires_at', new Date().toISOString())
        .or(`seller_id.eq.${userId},buyer_id.eq.${userId},buyer_id.is.null`)
        .order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      const { data: aiData, error: aiError } = await admin.from('ai_trade_offers')
        .select('id,seller_ai_id,buyer_ai_id,offered_assets,requested_assets,status,created_at,expires_at')
        .eq('status','open').is('buyer_ai_id',null).gt('expires_at',new Date().toISOString())
        .order('created_at',{ascending:false}).limit(100)
      if (aiError) throw aiError
      const ids=[...new Set((aiData||[]).map(x=>x.seller_ai_id))]
      let names: Record<number,string>={}
      if(ids.length){const {data: aiNames,error:nameError}=await admin.from('ai_accounts').select('account_id,name').in('account_id',ids);if(nameError)throw nameError;names=Object.fromEntries((aiNames||[]).map(x=>[x.account_id,x.name]))}
      return response({ ok: true, offers: data || [], ai_offers: (aiData||[]).map(x=>({...x,seller_type:'ai',seller_name:names[x.seller_ai_id]||('AI '+x.seller_ai_id)})) })
    }
    if (action === 'buy_ai_offer') {
      const offerId=String(body.offer_id||'')
      if(!/^[0-9a-f-]{36}$/i.test(offerId))return response({ok:false,error:'INVALID_OFFER_ID'},400)
      const {data,error}=await admin.rpc('settle_ai_trade_player',{p_offer_id:offerId,p_buyer_id:userId})
      if(error){const msg=String(error.message||'');const known=['BAZAAR_LISTING_NOT_OPEN','BAZAAR_LISTING_EXPIRED','BAZAAR_LISTING_NOT_PUBLIC','BAZAAR_AI_SELLER_MISSING','TRADE_PROFILE_MISSING','BAZAAR_UNSUPPORTED_ASSETS','INSUFFICIENT_CURRENCY','BAZAAR_AI_ITEM_UNAVAILABLE','BAZAAR_COSMETIC_UNAVAILABLE'];return response({ok:false,error:known.find(k=>msg.includes(k))||'BAZAAR_PURCHASE_FAILED'},400)}
      return response({ok:true,result:data})
    }
    if (action === 'history') {
      const { data, error } = await admin.from('trade_history')
        .select('id,offer_id,seller_id,buyer_id,offered_assets,requested_assets,completed_at')
        .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
        .order('completed_at', { ascending: false }).limit(50)
      if (error) throw error
      return response({ ok: true, history: data || [] })
    }
    if (action === 'create_offer') {
      const offered = cleanAssets(body.offered_assets)
      const requested = cleanAssets(body.requested_assets)
      const buyerId = typeof body.buyer_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.buyer_id) ? body.buyer_id : null
      if (buyerId === userId) return response({ ok: false, error: 'CANNOT_TRADE_WITH_SELF' }, 400)
      const { count: activeOffers, error: countError } = await admin.from('trade_offers').select('id', { count: 'exact', head: true }).eq('seller_id', userId).eq('status', 'open').gt('expires_at', new Date().toISOString())
      if (countError) throw countError
      if ((activeOffers || 0) >= 10) return response({ ok: false, error: 'ACTIVE_OFFER_LIMIT' }, 429)
      // The database locks the seller profile and treats open offers as reservations,
      // preventing concurrent offers from promising the same assets twice.
      const { data, error } = await admin.rpc('create_trade_offer', {
        p_seller_id: userId,
        p_buyer_id: buyerId,
        p_offered_assets: offered,
        p_requested_assets: requested,
      })
      if (error) {
        const message = String(error.message || '')
        const known = ['INVALID_TRADE_PARTICIPANTS','INVALID_TRADE_ASSETS','EMPTY_TRADE_ASSETS','INVALID_ASSET_AMOUNT','TRADE_PROFILE_MISSING','ACTIVE_OFFER_LIMIT','INSUFFICIENT_UNRESERVED_CURRENCY','INVALID_ITEM_AMOUNT','INVALID_COSMETIC_AMOUNT']
        const matched = known.find(k => message.includes(k))
        return response({ ok: false, error: matched || (message.startsWith('INSUFFICIENT_UNRESERVED_ITEM') ? 'INSUFFICIENT_ITEM' : message.startsWith('COSMETIC_ALREADY_RESERVED') ? 'COSMETIC_ALREADY_RESERVED' : 'TRADE_CREATE_FAILED') }, 400)
      }
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
