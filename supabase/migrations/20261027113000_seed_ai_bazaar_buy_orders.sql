-- Seed a small initial set of AI buy orders so players can sell ancient_power
-- and player-owned outfits/accessories immediately, without waiting for the next cron.
with candidates as (
  select a.account_id
  from public.ai_accounts a
  where a.coins >= 900
    and not exists (
      select 1 from public.ai_trade_offers o
      where o.seller_ai_id=a.account_id and o.status='open' and o.buyer_ai_id is null
        and o.expires_at>now()
        and (coalesce((o.offered_assets->>'coins')::bigint,0)>0 or coalesce((o.offered_assets->>'xp')::bigint,0)>0)
        and (coalesce(o.requested_assets->'items','{}'::jsonb)<>'{}'::jsonb
          or coalesce(o.requested_assets->'cosmetics','{}'::jsonb)<>'{}'::jsonb)
    )
  order by a.account_id
  limit 10
)
insert into public.ai_trade_offers
  (seller_ai_id,buyer_ai_id,offered_assets,requested_assets,estimated_offered_value,estimated_requested_value,status)
select c.account_id,null,
  jsonb_build_object('coins',900,'xp',0,'items','{}'::jsonb,'cosmetics','{}'::jsonb),
  jsonb_build_object('coins',0,'xp',0,'items',jsonb_build_object('ancient_power',1),'cosmetics','{}'::jsonb),
  900,900,'open'
from candidates c;

with cosmetic_catalog as (
  select distinct c.key as cosmetic_id
  from public.trade_profiles p
  cross join lateral jsonb_each(coalesce(p.cosmetics,'{}'::jsonb)) c
  where c.key <> '' and length(c.key)<=120 and c.key !~ '[[:cntrl:]]'
    and ((jsonb_typeof(c.value)='number' and (c.value #>> '{}') ~ '^[0-9]+$' and (c.value #>> '{}')::bigint>0)
      or c.value='true'::jsonb)
), candidates as (
  select distinct on (a.account_id)
    a.account_id,c.cosmetic_id
  from public.ai_accounts a
  cross join cosmetic_catalog c
  where a.coins>=5000 and coalesce(a.trade_cosmetics->>c.cosmetic_id,'false') not in ('true','1')
    and not exists (
      select 1 from public.ai_trade_offers o
      where o.seller_ai_id=a.account_id and o.status='open' and o.buyer_ai_id is null
        and o.expires_at>now()
        and (coalesce((o.offered_assets->>'coins')::bigint,0)>0 or coalesce((o.offered_assets->>'xp')::bigint,0)>0)
        and (coalesce(o.requested_assets->'items','{}'::jsonb)<>'{}'::jsonb
          or coalesce(o.requested_assets->'cosmetics','{}'::jsonb)<>'{}'::jsonb)
    )
  order by a.account_id,random()
  limit 10
)
insert into public.ai_trade_offers
  (seller_ai_id,buyer_ai_id,offered_assets,requested_assets,estimated_offered_value,estimated_requested_value,status)
select c.account_id,null,
  jsonb_build_object('coins',5000,'xp',0,'items','{}'::jsonb,'cosmetics','{}'::jsonb),
  jsonb_build_object('coins',0,'xp',0,'items','{}'::jsonb,'cosmetics',jsonb_build_object(c.cosmetic_id,true)),
  5000,5000,'open'
from candidates c;
