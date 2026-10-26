import { createClient } from 'npm:@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL') || ''
const RAW = Deno.env.get('SUPABASE_SECRET_KEYS') || ''
const TOKEN = Deno.env.get('AI_WORKER_TOKEN') || ''
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-ai-worker-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })
type Assets = { coins: number; xp: number; items: Record<string, number>; cosmetics: Record<string, boolean> }
type AI = { account_id: number; coins: number; player_xp: number; inventory_items: Record<string, unknown>; trade_cosmetics: Record<string, boolean>; strategy?: string; skill?: number; activity?: Record<string, unknown> }
let marketMultipliers: Record<string, number> = {}
function demandMultiplier(kind: 'item' | 'cosmetic', id: string) { return Math.max(0.65, Math.min(2.5, marketMultipliers[kind + ':' + id] || 1)) }

function serviceKey() {
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!key && RAW) {
    try { key = String((JSON.parse(RAW) as Record<string, unknown>).default || '') } catch { /* validated below */ }
  }
  if (!URL || !key || !TOKEN) throw new Error('SERVER_CONFIGURATION_MISSING')
  return key
}
function object(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
}
function int(v: unknown): number {
  const n = Number(v)
  return Number.isSafeInteger(n) && n >= 0 ? n : 0
}
function flatten(value: unknown, prefix = '', out: Record<string, number> = {}) {
  const row = object(value)
  for (const [key, raw] of Object.entries(row)) {
    const path = prefix ? prefix + ':' + key : key
    if (typeof raw === 'number' || typeof raw === 'string') {
      const n = Number(raw)
      if (Number.isSafeInteger(n) && n > 0) out[path] = n
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      flatten(raw, path, out)
    }
  }
  return out
}
function marketValue(id: string): number {
  const key = id.toLowerCase()
  const fixed: Record<string, number> = {
    normal_gold: 250,
    power_chest: 1200,
    golden_chest: 2400,
    ability_core: 1800,
    ancient_power: 900,
    latest_character_exchange_chest: 30000,
    'rarity_gold:ノーマル': 300,
    'rarity_gold:レア': 600,
    'rarity_gold:激レア': 1200,
    'rarity_gold:超激レア': 6000,
    'rarity_gold:伝説レア': 18000,
  }
  return Math.round((fixed[id] ?? fixed[key] ?? 150) * demandMultiplier('item', id))
}
function shuffle<T>(values: T[]): T[] {
  const a = values.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function availableAssets(ai: AI) {
  return flatten(ai.inventory_items)
}
function availableCosmetics(ai: AI) {
  return Object.entries(object(ai.trade_cosmetics)).filter(([, owned]) => owned === true).map(([id]) => id)
}
function makeOffer(seller: AI, buyer: AI): { offered: Assets; requested: Assets; itemId: string; price: number; value: number; currency: 'coins' | 'xp'; cosmetic: boolean } | null {
  const sellerItems = availableAssets(seller)
  const buyerItems = availableAssets(buyer)
  const buyerCosmetics = new Set(availableCosmetics(buyer))
  const cosmeticCandidates = shuffle(availableCosmetics(seller).filter(id => !buyerCosmetics.has(id)))
  const itemCandidates = shuffle(Object.entries(sellerItems).filter(([id, qty]) => qty >= 2 && id.length <= 120 && !/[\x00-\x1f]/.test(id) && !buyerItems[id]))
  const candidates = [
    ...cosmeticCandidates.map(id => ({ id, cosmetic: true })),
    ...itemCandidates.map(([id]) => ({ id, cosmetic: false })),
  ]
  for (const candidate of candidates) {
    const itemId = candidate.id
    const base = candidate.cosmetic ? Math.round(5000 * demandMultiplier('cosmetic', itemId)) : marketValue(itemId)
    const offeredAssets: Assets = candidate.cosmetic
      ? { coins: 0, xp: 0, items: {}, cosmetics: { [itemId]: true } }
      : { coins: 0, xp: 0, items: { [itemId]: 1 }, cosmetics: {} }
    // Sellers trade duplicates at a discount; buyers pay a premium for an item they do not own.
    const sellerFloor = Math.max(1, Math.round(base * 0.65))
    const buyerCeiling = Math.max(sellerFloor, Math.round(base * 1.2))
    const coinBalance = int(buyer.coins)
    if (coinBalance >= sellerFloor) {
      const price = Math.min(buyerCeiling, coinBalance)
      return {
        offered: offeredAssets,
        requested: { coins: price, xp: 0, items: {}, cosmetics: {} },
        itemId,
        price,
        value: price,
        currency: 'coins',
        cosmetic: candidate.cosmetic,
      }
    }
    // If coins are scarce, XP can be exchanged at a transparent internal reference rate.
    const xpPerCoin = 20
    const xpFloor = sellerFloor * xpPerCoin
    const xpCeiling = buyerCeiling * xpPerCoin
    const xpBalance = int(buyer.player_xp)
    if (xpBalance >= xpFloor) {
      const xpPrice = Math.min(xpCeiling, xpBalance)
      return {
        offered: offeredAssets,
        requested: { coins: 0, xp: xpPrice, items: {}, cosmetics: {} },
        itemId,
        price: xpPrice,
        value: Math.round(xpPrice / xpPerCoin),
        currency: 'xp',
        cosmetic: candidate.cosmetic,
      }
    }
  }
  return null
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return response({ ok: false, error: 'POST_ONLY' }, 405)
  if (!TOKEN || req.headers.get('x-ai-worker-token') !== TOKEN) return response({ ok: false, error: 'UNAUTHORIZED' }, 401)
  try {
    const body = object(await req.json().catch(() => ({})))
    const requestedBatch = Number(body.batch_size ?? 40)
    const batchSize = Number.isInteger(requestedBatch) ? Math.max(1, Math.min(100, requestedBatch)) : 40
    const admin = createClient(URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })
    const [{ data: playerTrades, error: playerTradeError }, { data: aiHistory, error: aiHistoryError }] = await Promise.all([
      admin.from('trade_history').select('offered_assets,requested_assets,completed_at').order('completed_at', { ascending: false }).limit(500),
      admin.from('ai_trade_offers').select('offered_assets,requested_assets,created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(500),
    ])
    if (playerTradeError) throw playerTradeError
    if (aiHistoryError) throw aiHistoryError
    const demand: Record<string, { requested: number; offered: number }> = {}
    const countAssets = (trade: any) => {
      const offered = object(trade.offered_assets), requested = object(trade.requested_assets)
      for (const [kind, key] of [['item', 'items'], ['cosmetic', 'cosmetics']] as const) {
        for (const [id, qty] of Object.entries(object(requested[key]))) if (int(qty) > 0 || qty === true) { const row = demand[kind + ':' + id] || { requested: 0, offered: 0 }; row.requested++; demand[kind + ':' + id] = row }
        for (const [id, qty] of Object.entries(object(offered[key]))) if (int(qty) > 0 || qty === true) { const row = demand[kind + ':' + id] || { requested: 0, offered: 0 }; row.offered++; demand[kind + ':' + id] = row }
      }
    }
    for (const trade of [...(playerTrades || []), ...(aiHistory || [])]) countAssets(trade)
    marketMultipliers = Object.fromEntries(Object.entries(demand).map(([id, row]) => [id, Math.max(0.65, Math.min(2.5, 0.8 + Math.log1p(row.requested) * 0.35 - Math.log1p(row.offered) * 0.12))]))
    const { data, error } = await admin.from('ai_accounts')
      .select('account_id,coins,player_xp,inventory_items,trade_cosmetics,strategy,skill,activity')
      .order('account_id', { ascending: true })
    if (error) throw error
    const accounts = (data || []) as AI[]
    const sellers = shuffle(accounts.filter(ai => Object.keys(availableAssets(ai)).length > 0 || availableCosmetics(ai).length > 0))
    let attempted = 0, completed = 0, noMatch = 0, failures = 0
    const trades: Array<{ seller: number; buyer: number; item: string; cosmetic: boolean; currency: 'coins' | 'xp'; amount: number }> = []
    const used = new Set<number>()
    for (const seller of sellers) {
      if (completed >= batchSize) break
      if (used.has(seller.account_id)) continue
      const buyerCandidates = shuffle(accounts.filter(ai =>
        ai.account_id !== seller.account_id && !used.has(ai.account_id) &&
        (int(ai.coins) > 0 || int(ai.player_xp) > 0)
      ))
      let didTrade = false
      for (const buyer of buyerCandidates.slice(0, 30)) {
        const offer = makeOffer(seller, buyer)
        if (!offer) continue
        attempted++
        const { data: inserted, error: insertError } = await admin.from('ai_trade_offers').insert({
          seller_ai_id: seller.account_id,
          buyer_ai_id: buyer.account_id,
          offered_assets: offer.offered,
          requested_assets: offer.requested,
          estimated_offered_value: marketValue(offer.itemId),
          estimated_requested_value: offer.value,
          status: 'open',
        }).select('id').single()
        if (insertError || !inserted) { failures++; continue }
        const { data: settled, error: settleError } = await admin.rpc('settle_ai_trade', {
          p_offer_id: inserted.id,
          p_buyer_ai_id: buyer.account_id,
        })
        if (settleError || !object(settled).ok) {
          failures++
          await admin.from('ai_trade_offers').update({ status: 'cancelled' }).eq('id', inserted.id).eq('status', 'open')
          continue
        }
        used.add(seller.account_id)
        used.add(buyer.account_id)
        // Keep the in-memory snapshots approximately current so a single batch cannot overspend.
        seller.inventory_items = object(seller.inventory_items)
        buyer.inventory_items = object(buyer.inventory_items)
        if (offer.currency === 'coins') {
          seller.coins = int(seller.coins) + offer.price
          buyer.coins = Math.max(0, int(buyer.coins) - offer.price)
        } else {
          seller.player_xp = int(seller.player_xp) + offer.price
          buyer.player_xp = Math.max(0, int(buyer.player_xp) - offer.price)
        }
        completed++
        trades.push({ seller: seller.account_id, buyer: buyer.account_id, item: offer.itemId, cosmetic: offer.cosmetic, currency: offer.currency, amount: offer.price })
        didTrade = true
        break
      }
      if (!didTrade) noMatch++
    }

    // Publish a small, bounded set of AI-owned items into the same public bazaar.
    const { data: activeAiListings, error: activeListingError } = await admin.from('ai_trade_offers')
      .select('seller_ai_id').eq('status','open').is('buyer_ai_id',null).gt('expires_at',new Date().toISOString())
    if(activeListingError) throw activeListingError
    const listedAiIds = new Set((activeAiListings||[]).map(x=>x.seller_ai_id))
    const { data: freshRows, error: freshError } = await admin.from('ai_accounts')
      .select('account_id,coins,player_xp,inventory_items,trade_cosmetics,name')
      .order('account_id',{ascending:true})
    if(freshError) throw freshError
    let aiListingsCreated=0
    for(const row of (freshRows||[]) as AI[]){
      if(aiListingsCreated>=Math.min(20,batchSize)||listedAiIds.has(row.account_id))continue
      const itemMap=availableAssets(row)
      const cosmeticIds=availableCosmetics(row)
      const itemCandidates=shuffle(Object.entries(itemMap).filter(([id,qty])=>qty>=2&&id.length<=120&&!/[\\x00-\\x1f]/.test(id)))
      const cosmeticCandidates=shuffle(cosmeticIds)
      const useCosmetic=cosmeticCandidates.length>0&&(itemCandidates.length===0||Math.random()<0.25)
      const itemId=useCosmetic?cosmeticCandidates[0]:itemCandidates[0]?.[0]
      if(!itemId)continue
      const cosmetic=useCosmetic
      const price=Math.max(1,Math.round(marketValue(itemId)*(0.9+Math.random()*0.35)))
      const offered:Assets=cosmetic
        ? {coins:0,xp:0,items:{},cosmetics:{[itemId]:true}}
        : {coins:0,xp:0,items:{[itemId]:1},cosmetics:{}}
      const {error:insertError}=await admin.from('ai_trade_offers').insert({
        seller_ai_id:row.account_id,buyer_ai_id:null,offered_assets:offered,
        requested_assets:{coins:price,xp:0,items:{},cosmetics:{}},
        estimated_offered_value:marketValue(itemId),estimated_requested_value:price,status:'open'
      })
      if(!insertError){listedAiIds.add(row.account_id);aiListingsCreated++}else{failures++}
    }

    // AI buyers also shop public AI listings. Claim each listing conditionally before
    // settlement so two workers cannot purchase the same offer at once.
    const { data: publicAiListings, error: publicAiListingsError } = await admin.from('ai_trade_offers')
      .select('id,seller_ai_id,offered_assets,requested_assets')
      .eq('status', 'open').is('buyer_ai_id', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true }).limit(Math.min(100, batchSize * 5))
    if (publicAiListingsError) throw publicAiListingsError
    let aiPublicListingsBought = 0
    for (const listing of (publicAiListings || [])) {
      if (aiPublicListingsBought >= Math.min(10, batchSize)) break
      const req = object(listing.requested_assets), off = object(listing.offered_assets)
      const reqItems = object(req.items), reqCosmetics = object(req.cosmetics)
      const offItems = object(off.items), offCosmetics = object(off.cosmetics)
      const priceCoins = int(req.coins), priceXp = int(req.xp)
      if ((priceCoins === 0 && priceXp === 0) || Object.keys(reqItems).length || Object.keys(reqCosmetics).length
        || int(off.coins) > 0 || int(off.xp) > 0
        || (!Object.keys(offItems).length && !Object.keys(offCosmetics).length)) continue
      for (const buyer of shuffle((freshRows || []) as AI[])) {
        if (buyer.account_id === listing.seller_ai_id || int(buyer.coins) < priceCoins || int(buyer.player_xp) < priceXp) continue
        const { data: claimed, error: claimError } = await admin.from('ai_trade_offers')
          .update({ buyer_ai_id: buyer.account_id })
          .eq('id', listing.id).eq('status', 'open').is('buyer_ai_id', null)
          .select('id').maybeSingle()
        if (claimError || !claimed) continue
        const { data: settled, error: settleError } = await admin.rpc('settle_ai_trade', {
          p_offer_id: listing.id, p_buyer_ai_id: buyer.account_id,
        })
        if (!settleError && object(settled).ok) {
          aiPublicListingsBought++
          if (priceCoins > 0) buyer.coins = Math.max(0, int(buyer.coins) - priceCoins)
          if (priceXp > 0) buyer.player_xp = Math.max(0, int(buyer.player_xp) - priceXp)
          break
        }
        // Reopen only if settlement left the listing open; never overwrite a completed trade.
        await admin.from('ai_trade_offers').update({ buyer_ai_id: null })
          .eq('id', listing.id).eq('status', 'open').eq('buyer_ai_id', buyer.account_id)
        if (settleError && !String(settleError.message || '').includes('BAZAAR_LISTING_NOT_OPEN')) failures++
      }
    }

    // AI buyers also shop public player listings. Only listings priced in coins/XP
    // and offering items/cosmetics are eligible for automated purchase.
    const {data: playerListings,error: playerListingsError}=await admin.from('trade_offers')
      .select('id,offered_assets,requested_assets,seller_id')
      .eq('status','open').is('buyer_id',null).gt('expires_at',new Date().toISOString())
      .order('created_at',{ascending:true}).limit(Math.min(100,batchSize*5))
    if(playerListingsError)throw playerListingsError
    let playerListingsBought=0
    const aiBuyers=shuffle((freshRows||[]) as AI[])
    for(const listing of (playerListings||[])){
      if(playerListingsBought>=Math.min(10,batchSize))break
      const req=object(listing.requested_assets), off=object(listing.offered_assets)
      const reqItems=object(req.items),reqCosmetics=object(req.cosmetics),offItems=object(off.items),offCosmetics=object(off.cosmetics)
      const priceCoins=int(req.coins),priceXp=int(req.xp)
      if((priceCoins===0&&priceXp===0)||Object.keys(reqItems).length||Object.keys(reqCosmetics).length
        ||(int(off.coins)>0||int(off.xp)>0)||(!Object.keys(offItems).length&&!Object.keys(offCosmetics).length))continue
      for(const buyer of aiBuyers){
        if(int(buyer.coins)<priceCoins||int(buyer.player_xp)<priceXp)continue
        const {data:settled,error:settleError}=await admin.rpc('settle_player_trade_ai',{p_offer_id:listing.id,p_buyer_ai_id:buyer.account_id})
        if(!settleError&&object(settled).ok){playerListingsBought++;break}
        if(settleError&&!String(settleError.message||'').includes('BAZAAR_LISTING_NOT_OPEN'))failures++
      }
    }
    return response({ ok: true, accounts: accounts.length, attempted, completed, no_match: noMatch, failures, trades, ai_listings_created:aiListingsCreated, ai_public_listings_bought:aiPublicListingsBought, player_listings_bought:playerListingsBought })
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : 'AI_TRADE_FAILED' }, 500)
  }
})
