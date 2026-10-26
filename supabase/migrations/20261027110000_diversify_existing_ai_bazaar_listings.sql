-- Replace legacy AI public listings that all offered ancient_power with another
-- item actually owned by that AI. Do not touch sellers with multiple active offers.
with open_counts as (
  select seller_ai_id, count(*) as offer_count
  from public.ai_trade_offers
  where status='open' and buyer_ai_id is null and expires_at>now()
  group by seller_ai_id
), candidates as (
  select distinct on (o.id)
    o.id,
    kv.key as item_id,
    case kv.key
      when 'normal_gold' then 250
      when 'power_chest' then 1200
      when 'golden_chest' then 2400
      when 'ability_core' then 1800
      when 'ancient_power' then 900
      when 'latest_character_exchange_chest' then 30000
      when 'skill_crystal' then 2500
      when 'rarity_gold:ノーマル' then 300
      when 'rarity_gold:レア' then 600
      when 'rarity_gold:激レア' then 1200
      when 'rarity_gold:超激レア' then 6000
      when 'rarity_gold:伝説レア' then 18000
      else 150
    end::bigint as base_value
  from public.ai_trade_offers o
  join open_counts c on c.seller_ai_id=o.seller_ai_id and c.offer_count=1
  join public.ai_accounts a on a.account_id=o.seller_ai_id
  cross join lateral jsonb_each(public.trade_flatten_inventory(a.inventory_items)) kv
  where o.status='open' and o.buyer_ai_id is null and o.expires_at>now()
    and coalesce(o.offered_assets->'items','{}'::jsonb) ? 'ancient_power'
    and kv.key <> 'ancient_power'
    and jsonb_typeof(kv.value)='number'
    and (kv.value #>> '{}') ~ '^[0-9]+$'
    and (kv.value #>> '{}')::bigint > 0
  order by o.id, random()
), changed as (
  update public.ai_trade_offers o
  set offered_assets=jsonb_build_object('coins',0,'xp',0,'items',jsonb_build_object(c.item_id,1),'cosmetics','{}'::jsonb),
      requested_assets=jsonb_build_object('coins',greatest(1,round(c.base_value*(0.9+random()*0.35))::bigint),'xp',0,'items','{}'::jsonb,'cosmetics','{}'::jsonb),
      estimated_offered_value=c.base_value,
      estimated_requested_value=greatest(1,round(c.base_value*(0.9+random()*0.35))::bigint)
  from candidates c
  where o.id=c.id
  returning o.id
)
select count(*) as diversified_legacy_listings from changed;
