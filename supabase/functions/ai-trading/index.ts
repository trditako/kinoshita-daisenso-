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
type Assets = { coins: number; xp: number; items: Record<string, number> }
type AI = { account_id: number; coins: number; player_xp: number; inventory_items: Record<string, unknown>; strategy?: string; skill?: number; activity?: Record<string, unknown> }

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
  return fixed[id] ?? fixed[key] ?? 150
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
function makeOffer(seller: AI, buyer: AI): { offered: Assets; requested: Assets; itemId: string; price: number; value: number; currency: 'coins' | 'xp' } | null {
  const sellerItems = availableAssets(seller)
  const buyerItems = availableAssets(buyer)
  const candidates = shuffle(Object.entries(sellerItems).filter(([id, qty]) =>
    qty >= 2 && /^[\\p{L}\\p{N}_:-]{1,120}$/u.test(id) && !buyerItems[id]
  ))
  for (const [itemId] of candidates) {
    const base = marketValue(itemId)
    // Sellers trade duplicates at a discount; buyers pay a premium for an item they do not own.
    const sellerFloor = Math.max(1, Math.round(base * 0.65))
    const buyerCeiling = Math.max(sellerFloor, Math.round(base * 1.2))
    const coinBalance = int(buyer.coins)
    if (coinBalance >= sellerFloor) {
      const price = Math.min(buyerCeiling, coinBalance)
      return {
        offered: { coins: 0, xp: 0, items: { [itemId]: 1 } },
        requested: { coins: price, xp: 0, items: {} },
        itemId,
        price,
        value: price,
        currency: 'coins',
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
        offered: { coins: 0, xp: 0, items: { [itemId]: 1 } },
        requested: { coins: 0, xp: xpPrice, items: {} },
        itemId,
        price: xpPrice,
        value: Math.round(xpPrice / xpPerCoin),
        currency: 'xp',
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
    const { data, error } = await admin.from('ai_accounts')
      .select('account_id,coins,player_xp,inventory_items,strategy,skill,activity')
      .order('account_id', { ascending: true })
    if (error) throw error
    const accounts = (data || []) as AI[]
    const sellers = shuffle(accounts.filter(ai => Object.keys(availableAssets(ai)).length > 0))
    let attempted = 0, completed = 0, noMatch = 0, failures = 0
    const trades: Array<{ seller: number; buyer: number; item: string; currency: 'coins' | 'xp'; amount: number }> = []
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
        trades.push({ seller: seller.account_id, buyer: buyer.account_id, item: offer.itemId, currency: offer.currency, amount: offer.price })
        didTrade = true
        break
      }
      if (!didTrade) noMatch++
    }
    return response({ ok: true, accounts: accounts.length, attempted, completed, no_match: noMatch, failures, trades })
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : 'AI_TRADE_FAILED' }, 500)
  }
})
