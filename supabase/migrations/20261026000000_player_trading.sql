create extension if not exists pgcrypto;

create table if not exists public.trade_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_id uuid unique,
  display_name text not null default 'プレイヤー',
  coins bigint not null default 0 check (coins >= 0),
  xp bigint not null default 0 check (xp >= 0),
  inventory jsonb not null default '{}'::jsonb check (jsonb_typeof(inventory) = 'object'),
  cosmetics jsonb not null default '{}'::jsonb check (jsonb_typeof(cosmetics) = 'object'),
  legacy_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.trade_profiles(user_id) on delete cascade,
  buyer_id uuid references public.trade_profiles(user_id) on delete cascade,
  offered_assets jsonb not null default '{}'::jsonb check (jsonb_typeof(offered_assets) = 'object'),
  requested_assets jsonb not null default '{}'::jsonb check (jsonb_typeof(requested_assets) = 'object'),
  status text not null default 'open' check (status in ('open','completed','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  completed_at timestamptz,
  constraint trade_offer_not_self check (buyer_id is null or buyer_id <> seller_id)
);

create index if not exists trade_offers_open_created_idx
  on public.trade_offers (created_at desc) where status = 'open';
create index if not exists trade_offers_seller_status_idx
  on public.trade_offers (seller_id, status);
create index if not exists trade_offers_buyer_status_idx
  on public.trade_offers (buyer_id, status);

create table if not exists public.trade_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.trade_offers(id),
  seller_id uuid not null,
  buyer_id uuid not null,
  offered_assets jsonb not null,
  requested_assets jsonb not null,
  completed_at timestamptz not null default now()
);

alter table public.trade_profiles enable row level security;
alter table public.trade_offers enable row level security;
alter table public.trade_history enable row level security;

drop policy if exists "trade_profiles_read_own" on public.trade_profiles;
create policy "trade_profiles_read_own" on public.trade_profiles
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "trade_offers_read_participating" on public.trade_offers;
create policy "trade_offers_read_participating" on public.trade_offers
  for select to authenticated using (
    seller_id = (select auth.uid()) or buyer_id = (select auth.uid()) or (buyer_id is null and status = 'open')
  );
drop policy if exists "trade_history_read_participating" on public.trade_history;
create policy "trade_history_read_participating" on public.trade_history
  for select to authenticated using (
    seller_id = (select auth.uid()) or buyer_id = (select auth.uid())
  );

revoke all on public.trade_profiles, public.trade_offers, public.trade_history from anon, authenticated;
grant select on public.trade_profiles, public.trade_offers, public.trade_history to authenticated;

create or replace function public.settle_trade(p_offer_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.trade_offers%rowtype;
  s public.trade_profiles%rowtype;
  b public.trade_profiles%rowtype;
  a jsonb;
  k text;
  n bigint;
begin
  select * into o from public.trade_offers where id = p_offer_id for update;
  if not found then raise exception 'TRADE_NOT_FOUND'; end if;
  if o.status <> 'open' then raise exception 'TRADE_NOT_OPEN'; end if;
  if o.expires_at <= now() then
    update public.trade_offers set status = 'expired' where id = o.id;
    raise exception 'TRADE_EXPIRED';
  end if;
  if p_actor = o.seller_id then raise exception 'CANNOT_ACCEPT_OWN_TRADE'; end if;
  if o.buyer_id is not null and o.buyer_id <> p_actor then raise exception 'TRADE_NOT_FOR_YOU'; end if;

  select * into s from public.trade_profiles where user_id = o.seller_id for update;
  select * into b from public.trade_profiles where user_id = p_actor for update;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;

  -- Validate both sides before changing any balance.
  for a in select value from jsonb_each(o.offered_assets) loop
    null;
  end loop;
  if coalesce((o.offered_assets->>'coins')::bigint,0) < 0
     or coalesce((o.offered_assets->>'xp')::bigint,0) < 0
     or coalesce((o.requested_assets->>'coins')::bigint,0) < 0
     or coalesce((o.requested_assets->>'xp')::bigint,0) < 0 then
    raise exception 'INVALID_ASSET_AMOUNT';
  end if;
  if s.coins < coalesce((o.offered_assets->>'coins')::bigint,0)
     or s.xp < coalesce((o.offered_assets->>'xp')::bigint,0)
     or b.coins < coalesce((o.requested_assets->>'coins')::bigint,0)
     or b.xp < coalesce((o.requested_assets->>'xp')::bigint,0) then
    raise exception 'INSUFFICIENT_CURRENCY';
  end if;

  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.offered_assets->'items','{}'::jsonb)) loop
    if n < 1 or coalesce((s.inventory->>k)::bigint,0) < n then raise exception 'INSUFFICIENT_ITEM:%', k; end if;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'items','{}'::jsonb)) loop
    if n < 1 or coalesce((b.inventory->>k)::bigint,0) < n then raise exception 'INSUFFICIENT_ITEM:%', k; end if;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.offered_assets->'cosmetics','{}'::jsonb)) loop
    if n <> 1 or coalesce((s.cosmetics->>k)::bigint,0) < 1 then raise exception 'INSUFFICIENT_COSMETIC:%', k; end if;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'cosmetics','{}'::jsonb)) loop
    if n <> 1 or coalesce((b.cosmetics->>k)::bigint,0) < 1 then raise exception 'INSUFFICIENT_COSMETIC:%', k; end if;
  end loop;

  -- Apply currency movements.
  update public.trade_profiles set
    coins = coins - coalesce((o.offered_assets->>'coins')::bigint,0) + coalesce((o.requested_assets->>'coins')::bigint,0),
    xp = xp - coalesce((o.offered_assets->>'xp')::bigint,0) + coalesce((o.requested_assets->>'xp')::bigint,0),
    updated_at = now()
  where user_id = o.seller_id;
  update public.trade_profiles set
    coins = coins - coalesce((o.requested_assets->>'coins')::bigint,0) + coalesce((o.offered_assets->>'coins')::bigint,0),
    xp = xp - coalesce((o.requested_assets->>'xp')::bigint,0) + coalesce((o.offered_assets->>'xp')::bigint,0),
    updated_at = now()
  where user_id = p_actor;

  -- Transfer stackable items, deleting zero-count keys.
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.offered_assets->'items','{}'::jsonb)) loop
    update public.trade_profiles set inventory =
      (case when coalesce((inventory->>k)::bigint,0)-n=0 then inventory - k else jsonb_set(inventory,k::text::text[],to_jsonb(coalesce((inventory->>k)::bigint,0)-n),true) end),
      updated_at=now() where user_id=o.seller_id;
    update public.trade_profiles set inventory=jsonb_set(inventory,k::text::text[],to_jsonb(coalesce((inventory->>k)::bigint,0)+n),true),updated_at=now() where user_id=p_actor;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'items','{}'::jsonb)) loop
    update public.trade_profiles set inventory=(case when coalesce((inventory->>k)::bigint,0)-n=0 then inventory-k else jsonb_set(inventory,k::text::text[],to_jsonb(coalesce((inventory->>k)::bigint,0)-n),true) end),updated_at=now() where user_id=p_actor;
    update public.trade_profiles set inventory=jsonb_set(inventory,k::text::text[],to_jsonb(coalesce((inventory->>k)::bigint,0)+n),true),updated_at=now() where user_id=o.seller_id;
  end loop;

  -- Cosmetics are unique, non-stackable ownership keys.
  for k in select key from jsonb_each(coalesce(o.offered_assets->'cosmetics','{}'::jsonb)) loop
    update public.trade_profiles set cosmetics=cosmetics-k,updated_at=now() where user_id=o.seller_id;
    update public.trade_profiles set cosmetics=jsonb_set(cosmetics,array[k],'1'::jsonb,true),updated_at=now() where user_id=p_actor;
  end loop;
  for k in select key from jsonb_each(coalesce(o.requested_assets->'cosmetics','{}'::jsonb)) loop
    update public.trade_profiles set cosmetics=cosmetics-k,updated_at=now() where user_id=p_actor;
    update public.trade_profiles set cosmetics=jsonb_set(cosmetics,array[k],'1'::jsonb,true),updated_at=now() where user_id=o.seller_id;
  end loop;

  update public.trade_offers set status='completed', buyer_id=p_actor, completed_at=now() where id=o.id;
  insert into public.trade_history(offer_id,seller_id,buyer_id,offered_assets,requested_assets)
    values(o.id,o.seller_id,p_actor,o.offered_assets,o.requested_assets);
  return jsonb_build_object('ok',true,'offer_id',o.id,'status','completed');
end;
$$;

revoke all on function public.settle_trade(uuid,uuid) from public, anon, authenticated;
grant execute on function public.settle_trade(uuid,uuid) to service_role;
