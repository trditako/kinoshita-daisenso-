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
function makeOffer(seller: AI, buyer: AI): { offered: Assets; requested: Assets; itemId: string; price: number; value: number; currency: 'coins' | 'xp' | 'barter'; cosmetic: boolean } | null {
  const sellerItems = availableAssets(seller)
  const buyerItems = availableAssets(buyer)
  const buyerCosmetics = new Set(availableCosmetics(buyer))
  const sellerCosmetics = new Set(availableCosmetics(seller))
  const cosmeticCandidates = shuffle(availableCosmetics(seller).filter(id => !buyerCosmetics.has(id)))
  const itemCandidates = shuffle(Object.entries(sellerItems).filter(([id, qty]) => qty >= 1 && id.length <= 120 && !/[\\x00-\\x1f]/.test(id) && !buyerItems[id]))
  // AI wish lists may request surplus items and cosmetics, not only currency.
  const buyerBarterItems = shuffle(Object.entries(buyerItems).filter(([id, qty]) => qty >= 2 && id.length <= 120 && !/[\\x00-\\x1f]/.test(id) && !sellerItems[id]))
  const buyerBarterCosmetics = shuffle(availableCosmetics(buyer).filter(id => !sellerCosmetics.has(id)))
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
    // Trade surplus inventory only, so AI does not offer its only copy of an item.
    if (Math.random() < 0.35 && (buyerBarterItems.length || buyerBarterCosmetics.length)) {
      const useCosmetic = buyerBarterCosmetics.length > 0 && (buyerBarterItems.length === 0 || Math.random() < 0.3)
      const requested: Assets = useCosmetic
        ? { coins: 0, xp: 0, items: {}, cosmetics: { [buyerBarterCosmetics[0]]: true } }
        : { coins: 0, xp: 0, items: { [buyerBarterItems[0][0]]: 1 }, cosmetics: {} }
      return { offered: offeredAssets, requested, itemId, price: 0, value: base, currency: 'barter', cosmetic: candidate.cosmetic }
    }
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
      admin.from('ai_trade_offers').select('offered_assets,requested_assets,completed_at,created_at').eq('status', 'completed').order('completed_at', { ascending: false }).limit(500),
    ])
    if (playerTradeError) throw playerTradeError
    if (aiHistoryError) throw aiHistoryError
    const demand: Record<string, { requested: number; offered: number }> = {}
    const realized: Record<string, { sum: number; count: number }> = {}
    const baseItemValue = (id: string) => ({normal_gold:250,power_chest:1200,golden_chest:2400,ability_core:1800,ancient_power:900,latest_character_exchange_chest:30000,'rarity_gold:ノーマル':300,'rarity_gold:レア':600,'rarity_gold:激レア':1200,'rarity_gold:超激レア':6000,'rarity_gold:伝説レア':18000}[id] ?? 150)
    const countAssets = (trade: any) => {
      const offered = object(trade.offered_assets), requested = object(trade.requested_assets)
      for (const [kind, key] of [['item', 'items'], ['cosmetic', 'cosmetics']] as const) {
        for (const [id, qty] of Object.entries(object(requested[key]))) if (int(qty) > 0 || qty === true) { const row = demand[kind + ':' + id] || { requested: 0, offered: 0 }; row.requested++; demand[kind + ':' + id] = row }
        for (const [id, qty] of Object.entries(object(offered[key]))) if (int(qty) > 0 || qty === true) { const row = demand[kind + ':' + id] || { requested: 0, offered: 0 }; row.offered++; demand[kind + ':' + id] = row }
      }
      const cashValue = int(requested.coins) + Math.round(int(requested.xp) / 20)
      if (cashValue <= 0) return
      const assets: Array<{ key: string; value: number; qty: number }> = []
      for (const [id, qty] of Object.entries(object(offered.items))) if (int(qty) > 0) assets.push({key:'item:'+id,value:baseItemValue(id),qty:int(qty)})
      for (const [id, qty] of Object.entries(object(offered.cosmetics))) if (qty === true || int(qty) > 0) assets.push({key:'cosmetic:'+id,value:5000,qty:qty===true?1:int(qty)})
      const totalBase=assets.reduce((sum,a)=>sum+a.value*a.qty,0)
      if(totalBase<=0)return
      const ratio=Math.max(0.5,Math.min(2,cashValue/totalBase))
      for(const a of assets){const row=realized[a.key]||{sum:0,count:0};row.sum+=ratio;row.count++;realized[a.key]=row}
    }
    for (const trade of [...(playerTrades || []), ...(aiHistory || [])]) countAssets(trade)
    marketMultipliers = Object.fromEntries([...new Set([...Object.keys(demand),...Object.keys(realized)])].map(id => {
      const row=demand[id]||{requested:0,offered:0}
      const demandFactor=Math.max(0.65,Math.min(2.5,0.8+Math.log1p(row.requested)*0.35-Math.log1p(row.offered)*0.12))
      const sale=realized[id]
      const realizedFactor=sale&&sale.count?Math.max(0.75,Math.min(1.35,Math.pow(sale.sum/sale.count,0.35))):1
      return [id,Math.max(0.65,Math.min(2.5,demandFactor*realizedFactor))]
    }))
    const { data, error } = await admin.from('ai_accounts')
      .select('account_id,coins,player_xp,inventory_items,trade_cosmetics,strategy,skill,activity')
      .order('account_id', { ascending: true })
    if (error) throw error
    const accounts = (data || []) as AI[]
    const sellers = shuffle(accounts.filter(ai => Object.keys(availableAssets(ai)).length > 0 || availableCosmetics(ai).length > 0))
    let attempted = 0, completed = 0, noMatch = 0, failures = 0
    const trades: Array<{ seller: number; buyer: number; item: string; cosmetic: boolean; currency: 'coins' | 'xp' | 'barter'; amount: number }> = []
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
        } else if (offer.currency === 'xp') {
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
      .select('id,seller_ai_id,offered_assets,requested_assets,estimated_offered_value,created_at').eq('status','open').is('buyer_ai_id',null).gt('expires_at',new Date().toISOString())
    if(activeListingError) throw activeListingError
    const activeByAi = new Map<number, Set<string>>()
    let aiListingsRepriced=0
    for(const listing of (activeAiListings||[])){
      const offered=object(listing.offered_assets), requested=object(listing.requested_assets)
      const ageHours=Math.max(0,(Date.now()-Date.parse(String(listing.created_at||new Date().toISOString())))/3600000)
      const targetFactor=ageHours<1?null:ageHours<3?1.08:ageHours<6?1.00:ageHours<12?0.93:ageHours<18?0.87:ageHours<24?0.82:0.75
      const itemEntries=Object.entries(object(offered.items)).filter(([,qty])=>int(qty)>0)
      const cosmeticEntries=Object.entries(object(offered.cosmetics)).filter(([,qty])=>qty===true||int(qty)>0)
      if(targetFactor!==null&&(itemEntries.length+cosmeticEntries.length)===1&&int(requested.coins)>0&&!int(requested.xp)&&!Object.keys(object(requested.items)).length&&!Object.keys(object(requested.cosmetics)).length){
        const isCosmetic=cosmeticEntries.length===1, assetId=isCosmetic?cosmeticEntries[0][0]:itemEntries[0][0]
        const base=Math.max(1,Number(listing.estimated_offered_value)||(isCosmetic?Math.round(5000*demandMultiplier('cosmetic',assetId)):marketValue(assetId)))
        const nextPrice=Math.max(1,Math.round(base*targetFactor))
        if(nextPrice<int(requested.coins)){
          const {error:priceError}=await admin.from('ai_trade_offers').update({requested_assets:{...requested,coins:nextPrice},estimated_requested_value:nextPrice}).eq('id',listing.id).eq('status','open').is('buyer_ai_id',null)
          if(!priceError)aiListingsRepriced++
        }
      }
    }
    const { data: freshRows, error: freshError } = await admin.from('ai_accounts')
      .select('account_id,coins,player_xp,inventory_items,trade_cosmetics,name')
      .order('account_id',{ascending:true})
    if(freshError) throw freshError

    // Reconcile every existing public AI listing against current server-side holdings.
    // A listing is cancelled if the AI no longer owns the offered assets, or if
    // earlier open listings already reserve those quantities/balances.
    const aiById = new Map<number, AI>((freshRows || []).map(row => [row.account_id, row as AI] as [number, AI]))
    const reservedByAi = new Map<number, { items: Record<string, number>; cosmetics: Set<string>; coins: number; xp: number }>()
    let aiListingsCancelledForMissingAssets = 0
    const currentListings = [...(activeAiListings || [])].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    for (const listing of currentListings) {
      const ai = aiById.get(listing.seller_ai_id)
      const offered = object(listing.offered_assets)
      const itemEntries = Object.entries(object(offered.items)).filter(([, qty]) => int(qty) > 0)
      const cosmeticEntries = Object.entries(object(offered.cosmetics)).filter(([, qty]) => qty === true || int(qty) > 0)
      const coins = int(offered.coins), xp = int(offered.xp)
      const reserved = reservedByAi.get(listing.seller_ai_id) || { items: {}, cosmetics: new Set<string>(), coins: 0, xp: 0 }
      let valid = !!ai && (itemEntries.length + cosmeticEntries.length + (coins > 0 ? 1 : 0) + (xp > 0 ? 1 : 0) > 0)
      const ownedItems = ai ? availableAssets(ai) : {}
      const ownedCosmetics = new Set(ai ? availableCosmetics(ai) : [])
      for (const [id, qty] of itemEntries) {
        if (!ownedItems[id] || (reserved.items[id] || 0) + int(qty) > ownedItems[id]) valid = false
      }
      for (const [id] of cosmeticEntries) {
        if (!ownedCosmetics.has(id) || reserved.cosmetics.has(id)) valid = false
      }
      if (!ai || reserved.coins + coins > int(ai.coins) || reserved.xp + xp > int(ai.player_xp)) valid = false
      if (!valid) {
        const { error: cancelError } = await admin.from('ai_trade_offers').update({ status: 'cancelled' }).eq('id', listing.id).eq('status', 'open')
        if (cancelError) failures++
        else { aiListingsCancelledForMissingAssets++ }
        continue
      }
      for (const [id, qty] of itemEntries) reserved.items[id] = (reserved.items[id] || 0) + int(qty)
      for (const [id] of cosmeticEntries) reserved.cosmetics.add(id)
      reserved.coins += coins
      reserved.xp += xp
      reservedByAi.set(listing.seller_ai_id, reserved)
      const ids = activeByAi.get(listing.seller_ai_id) || new Set<string>()
      for (const [id] of itemEntries) ids.add('item:' + id)
      for (const [id] of cosmeticEntries) ids.add('cosmetic:' + id)
      activeByAi.set(listing.seller_ai_id, ids)
    }

    const { data: publicInventoryRows, error: publicInventoryError } = await admin.from('trade_profiles').select('inventory,cosmetics').limit(1000)
    if(publicInventoryError) throw publicInventoryError
    const marketItemIds = new Set<string>(), marketCosmeticIds = new Set<string>()
    for(const profile of (publicInventoryRows||[])) {
      for(const [id, qty] of Object.entries(flatten(profile.inventory))) if(qty>0&&id.length<=120&&!/[\\x00-\\x1f]/.test(id)) marketItemIds.add(id)
      for(const [id, qty] of Object.entries(object(profile.cosmetics))) if((qty===true||int(qty)>0)&&id.length<=120&&!/[\\x00-\\x1f]/.test(id)) marketCosmeticIds.add(id)
    }
    for(const ai of (freshRows||[]) as AI[]) {
      for(const [id, qty] of Object.entries(availableAssets(ai))) if(qty>0) marketItemIds.add(id)
      for(const id of availableCosmetics(ai)) marketCosmeticIds.add(id)
    }
    let aiListingsCreated=0
    for(const row of shuffle((freshRows||[]) as AI[])){
      if(aiListingsCreated>=Math.min(20,batchSize))break
      const activeIds=activeByAi.get(row.account_id)||new Set<string>()
      if(activeIds.size>=3)continue
      const itemMap=availableAssets(row)
      const cosmeticIds=availableCosmetics(row)
      const itemCandidates=shuffle(Object.entries(itemMap).filter(([id,qty])=>qty>=1&&id.length<=120&&!/[\\x00-\\x1f]/.test(id)&&!activeIds.has('item:'+id)))
      const cosmeticCandidates=shuffle(cosmeticIds.filter(id=>!activeIds.has('cosmetic:'+id)))
      const candidates=[...itemCandidates.map(([id])=>({id,cosmetic:false})),...cosmeticCandidates.map(id=>({id,cosmetic:true}))]
      const candidate=candidates[Math.floor(Math.random()*candidates.length)]
      if(!candidate)continue
      const itemId=candidate.id,cosmetic=candidate.cosmetic
      const referenceValue=cosmetic?Math.round(5000*demandMultiplier('cosmetic',itemId)):marketValue(itemId)
      const price=Math.max(1,Math.round(referenceValue*(1.08+Math.random()*0.10)))
      const offered:Assets=cosmetic
        ? {coins:0,xp:0,items:{},cosmetics:{[itemId]:true}}
        : {coins:0,xp:0,items:{[itemId]:1},cosmetics:{}}
      const ownItems = availableAssets(row), ownCosmetics = new Set(availableCosmetics(row))
      const wantedItems = shuffle([...marketItemIds].filter(id=>id!==itemId&&!ownItems[id]&&id.length<=120&&!/[\\x00-\\x1f]/.test(id)))
      const wantedCosmetics = shuffle([...marketCosmeticIds].filter(id=>!ownCosmetics.has(id)&&id!==itemId&&id.length<=120&&!/[\\x00-\\x1f]/.test(id)))
      let requested:Assets = {coins:price,xp:0,items:{},cosmetics:{}}
      let requestedValue = price
      if((wantedItems.length||wantedCosmetics.length)&&Math.random()<0.35) {
        const wantCosmetic = wantedCosmetics.length>0&&(wantedItems.length===0||Math.random()<0.35)
        const wantId = wantCosmetic?wantedCosmetics[0]:wantedItems[0]
        requested = wantCosmetic
          ? {coins:0,xp:0,items:{},cosmetics:{[wantId]:true}}
          : {coins:0,xp:0,items:{[wantId]:1},cosmetics:{}}
        requestedValue = wantCosmetic?Math.round(5000*demandMultiplier('cosmetic',wantId)):marketValue(wantId)
      }
      const {error:insertError}=await admin.from('ai_trade_offers').insert({
        seller_ai_id:row.account_id,buyer_ai_id:null,offered_assets:offered,
        requested_assets:requested,
        estimated_offered_value:referenceValue,estimated_requested_value:requestedValue,status:'open'
      })
      if(!insertError){activeIds.add((cosmetic?'cosmetic:':'item:')+itemId);activeByAi.set(row.account_id,activeIds);aiListingsCreated++}else{failures++}
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
      if (int(off.coins) > 0 || int(off.xp) > 0
        || (!Object.keys(offItems).length && !Object.keys(offCosmetics).length)
        || (!priceCoins && !priceXp && !Object.keys(reqItems).length && !Object.keys(reqCosmetics).length)) continue
      for (const buyer of shuffle((freshRows || []) as AI[])) {
        if (buyer.account_id === listing.seller_ai_id || int(buyer.coins) < priceCoins || int(buyer.player_xp) < priceXp) continue
        const buyerItems = availableAssets(buyer), buyerCosmetics = new Set(availableCosmetics(buyer))
        if (Object.entries(reqItems).some(([id, qty]) => (buyerItems[id] || 0) < Math.max(1, int(qty)))) continue
        if (Object.keys(reqCosmetics).some(id => !buyerCosmetics.has(id))) continue
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
    // Publish AI buy orders for items/cosmetics the account does not own.
    // Each AI has at most one active buy order; settlement revalidates funds and
    // the player's unreserved inventory atomically in the database.
    const { data: openPublicOffers, error: openPublicError } = await admin.from('ai_trade_offers')
      .select('seller_ai_id,offered_assets,requested_assets')
      .eq('status','open').is('buyer_ai_id',null).gt('expires_at',new Date().toISOString())
    if(openPublicError)throw openPublicError
    const activeBuyers = new Set((openPublicOffers||[]).filter(o => {
      const off=object(o.offered_assets), req=object(o.requested_assets)
      return (int(off.coins)>0||int(off.xp)>0) && Object.keys(object(req.items)).length+Object.keys(object(req.cosmetics)).length>0
    }).map(o=>o.seller_ai_id))
    const ownedItemIds = new Set<string>(), ownedCosmeticIds = new Set<string>()
    for(const row of (freshRows||[]) as AI[]) {
      for(const id of Object.keys(availableAssets(row)))ownedItemIds.add(id)
      for(const id of availableCosmetics(row))ownedCosmeticIds.add(id)
    }
    // Cosmetics can be player-owned before any AI has collected them. Include
    // actual player inventory IDs in the wish-list catalog so they can be sold.
    const {data: playerCosmeticRows,error: playerCosmeticError}=await admin.from('trade_profiles').select('cosmetics').limit(1000)
    if(playerCosmeticError)throw playerCosmeticError
    for(const profile of (playerCosmeticRows||[])) {
      for(const [id,qty] of Object.entries(object(profile.cosmetics))) {
        if(id.length<=120&&!/[\\x00-\\x1f]/.test(id)&&(qty===true||int(qty)>0))ownedCosmeticIds.add(id)
      }
    }
    let aiBuyOrdersCreated=0
    for(const row of shuffle((freshRows||[]) as AI[])) {
      if(aiBuyOrdersCreated>=Math.min(20,batchSize)||activeBuyers.has(row.account_id))continue
      const ownItems=availableAssets(row), ownCosmetics=new Set(availableCosmetics(row))
      const itemWishes=shuffle([...ownedItemIds].filter(id=>id.length<=120&&!/[\\x00-\\x1f]/.test(id)))
      const cosmeticWishes=shuffle([...ownedCosmeticIds].filter(id=>!ownCosmetics.has(id)&&id.length<=120&&!/[\\x00-\\x1f]/.test(id)))
      if(!itemWishes.length&&!cosmeticWishes.length)continue
      const useCosmetic=cosmeticWishes.length>0&&(itemWishes.length===0||Math.random()<0.35)
      const wishId=useCosmetic?cosmeticWishes[0]:itemWishes[0]
      const reference=useCosmetic?5000:marketValue(wishId)
      const price=Math.max(1,Math.round(reference*(0.8+Math.random()*0.2)))
      const useXp=int(row.coins)<price&&int(row.player_xp)>=price*20
      if(int(row.coins)<price&&!useXp)continue
      const offered:Assets=useXp
        ? {coins:0,xp:price*20,items:{},cosmetics:{}}
        : {coins:price,xp:0,items:{},cosmetics:{}}
      const requested:Assets=useCosmetic
        ? {coins:0,xp:0,items:{},cosmetics:{[wishId]:true}}
        : {coins:0,xp:0,items:{[wishId]:1},cosmetics:{}}
      const {error:buyOrderError}=await admin.from('ai_trade_offers').insert({
        seller_ai_id:row.account_id,buyer_ai_id:null,offered_assets:offered,requested_assets:requested,
        estimated_offered_value:price,estimated_requested_value:reference,status:'open'
      })
      if(!buyOrderError){activeBuyers.add(row.account_id);aiBuyOrdersCreated++}else{failures++}
    }
    return response({ ok: true, accounts: accounts.length, attempted, completed, no_match: noMatch, failures, trades, ai_listings_created:aiListingsCreated, ai_listings_repriced:aiListingsRepriced, ai_public_listings_bought:aiPublicListingsBought, player_listings_bought:playerListingsBought, ai_buy_orders_created:aiBuyOrdersCreated, ai_listings_cancelled_missing_assets:aiListingsCancelledForMissingAssets })
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : 'AI_TRADE_FAILED' }, 500)
  }
})
