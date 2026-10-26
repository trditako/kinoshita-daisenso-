-- Atomic AI-to-AI trading for server-owned AI balances, inventory, and unique cosmetics.
alter table public.ai_accounts add column if not exists trade_cosmetics jsonb not null default '{}'::jsonb;
alter table public.ai_accounts drop constraint if exists ai_accounts_trade_cosmetics_object;
alter table public.ai_accounts add constraint ai_accounts_trade_cosmetics_object check (jsonb_typeof(trade_cosmetics) = 'object');
create or replace function public.trade_jsonb_adjust(p_doc jsonb, p_path text[], p_delta bigint)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  child jsonb;
  next_doc jsonb;
  current_value bigint;
begin
  if coalesce(array_length(p_path, 1), 0) = 0 then
    raise exception 'INVALID_ITEM_PATH';
  end if;
  k := p_path[1];
  if array_length(p_path, 1) = 1 then
    current_value := coalesce((p_doc ->> k)::bigint, 0);
    if current_value + p_delta < 0 then raise exception 'INSUFFICIENT_ITEM:%', k; end if;
    return jsonb_set(coalesce(p_doc, '{}'::jsonb), array[k], to_jsonb(current_value + p_delta), true);
  end if;
  child := coalesce(p_doc -> k, '{}'::jsonb);
  if jsonb_typeof(child) <> 'object' then raise exception 'INVALID_ITEM_PATH:%', k; end if;
  next_doc := public.trade_jsonb_adjust(child, p_path[2:array_length(p_path, 1)], p_delta);
  return jsonb_set(coalesce(p_doc, '{}'::jsonb), array[k], next_doc, true);
end;
$$;

create table if not exists public.ai_trade_offers (
  id uuid primary key default gen_random_uuid(),
  seller_ai_id integer not null references public.ai_accounts(account_id) on delete cascade,
  buyer_ai_id integer references public.ai_accounts(account_id) on delete cascade,
  offered_assets jsonb not null check (jsonb_typeof(offered_assets) = 'object'),
  requested_assets jsonb not null check (jsonb_typeof(requested_assets) = 'object'),
  estimated_offered_value bigint not null default 0 check (estimated_offered_value >= 0),
  estimated_requested_value bigint not null default 0 check (estimated_requested_value >= 0),
  status text not null default 'open' check (status in ('open','completed','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 days'),
  completed_at timestamptz,
  constraint ai_trade_offer_not_self check (buyer_ai_id is null or buyer_ai_id <> seller_ai_id)
);
create index if not exists ai_trade_offers_open_created_idx
  on public.ai_trade_offers (created_at desc) where status = 'open';
create index if not exists ai_trade_offers_seller_status_idx
  on public.ai_trade_offers (seller_ai_id, status);
create index if not exists ai_trade_offers_buyer_status_idx
  on public.ai_trade_offers (buyer_ai_id, status);

create table if not exists public.ai_trade_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.ai_trade_offers(id),
  seller_ai_id integer not null,
  buyer_ai_id integer not null,
  offered_assets jsonb not null,
  requested_assets jsonb not null,
  offered_value bigint not null,
  requested_value bigint not null,
  completed_at timestamptz not null default now()
);
alter table public.ai_trade_offers enable row level security;
alter table public.ai_trade_history enable row level security;
revoke all on public.ai_trade_offers, public.ai_trade_history from anon, authenticated;
grant select, insert, update, delete on public.ai_trade_offers, public.ai_trade_history to service_role;
revoke all on function public.trade_jsonb_adjust(jsonb, text[], bigint) from public, anon, authenticated;
grant execute on function public.trade_jsonb_adjust(jsonb, text[], bigint) to service_role;

create or replace function public.settle_ai_trade(p_offer_id uuid, p_buyer_ai_id integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ai_trade_offers%rowtype;
  s public.ai_accounts%rowtype;
  b public.ai_accounts%rowtype;
  k text;
  n bigint;
  offered_coins bigint;
  offered_xp bigint;
  requested_coins bigint;
  requested_xp bigint;
  offered_items jsonb;
  requested_items jsonb;
  s_inventory jsonb;
  b_inventory jsonb;
  s_cosmetics jsonb;
  b_cosmetics jsonb;
  offered_cosmetics jsonb;
  requested_cosmetics jsonb;
  cosmetic_id text;
  cosmetic_owned jsonb;
begin
  select * into o from public.ai_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'AI_TRADE_NOT_FOUND'; end if;
  if o.status <> 'open' then raise exception 'AI_TRADE_NOT_OPEN'; end if;
  if o.expires_at <= now() then
    update public.ai_trade_offers set status = 'expired' where id = o.id;
    raise exception 'AI_TRADE_EXPIRED';
  end if;
  if o.buyer_ai_id is not null and o.buyer_ai_id <> p_buyer_ai_id then raise exception 'AI_TRADE_NOT_FOR_YOU'; end if;
  if o.seller_ai_id = p_buyer_ai_id then raise exception 'AI_CANNOT_TRADE_WITH_SELF'; end if;

  perform account_id from public.ai_accounts
    where account_id in (o.seller_ai_id, p_buyer_ai_id)
    order by account_id for update;
  select * into s from public.ai_accounts where account_id = o.seller_ai_id;
  if not found then raise exception 'AI_SELLER_NOT_FOUND'; end if;
  select * into b from public.ai_accounts where account_id = p_buyer_ai_id;
  if not found then raise exception 'AI_BUYER_NOT_FOUND'; end if;

  offered_coins := coalesce((o.offered_assets->>'coins')::bigint, 0);
  offered_xp := coalesce((o.offered_assets->>'xp')::bigint, 0);
  requested_coins := coalesce((o.requested_assets->>'coins')::bigint, 0);
  requested_xp := coalesce((o.requested_assets->>'xp')::bigint, 0);
  offered_items := coalesce(o.offered_assets->'items', '{}'::jsonb);
  requested_items := coalesce(o.requested_assets->'items', '{}'::jsonb);
  offered_cosmetics := coalesce(o.offered_assets->'cosmetics', '{}'::jsonb);
  requested_cosmetics := coalesce(o.requested_assets->'cosmetics', '{}'::jsonb);
  if offered_coins < 0 or offered_xp < 0 or requested_coins < 0 or requested_xp < 0
     or jsonb_typeof(offered_items) <> 'object' or jsonb_typeof(requested_items) <> 'object'
     or jsonb_typeof(offered_cosmetics) <> 'object' or jsonb_typeof(requested_cosmetics) <> 'object' then
    raise exception 'AI_TRADE_INVALID_ASSETS';
  end if;
  if (offered_coins + offered_xp = 0 and offered_items = '{}'::jsonb and offered_cosmetics = '{}'::jsonb)
     or (requested_coins + requested_xp = 0 and requested_items = '{}'::jsonb and requested_cosmetics = '{}'::jsonb) then
    raise exception 'AI_TRADE_EMPTY_ASSETS';
  end if;
  if s.coins < offered_coins or s.player_xp < offered_xp
     or b.coins < requested_coins or b.player_xp < requested_xp then
    raise exception 'AI_TRADE_INSUFFICIENT_CURRENCY';
  end if;

  s_inventory := coalesce(s.inventory_items, '{}'::jsonb);
  b_inventory := coalesce(b.inventory_items, '{}'::jsonb);
  s_cosmetics := coalesce(s.trade_cosmetics, '{}'::jsonb);
  b_cosmetics := coalesce(b.trade_cosmetics, '{}'::jsonb);
  -- Validate both sides against pre-trade ownership before applying any transfer.
  for k,n in select key, value::text::bigint from jsonb_each_text(offered_items) loop
    if length(k) < 1 or length(k) > 120 or k ~ '[[:cntrl:]]' or n < 1 then raise exception 'AI_TRADE_INVALID_ITEM'; end if;
    if coalesce((s_inventory #>> string_to_array(k, ':'))::bigint, 0) < n then raise exception 'AI_TRADE_INSUFFICIENT_ITEM:%', k; end if;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(requested_items) loop
    if length(k) < 1 or length(k) > 120 or k ~ '[[:cntrl:]]' or n < 1 then raise exception 'AI_TRADE_INVALID_ITEM'; end if;
    if coalesce((b_inventory #>> string_to_array(k, ':'))::bigint, 0) < n then raise exception 'AI_TRADE_INSUFFICIENT_ITEM:%', k; end if;
  end loop;
  for cosmetic_id,cosmetic_owned in select key,value from jsonb_each(offered_cosmetics) loop
    if length(cosmetic_id) < 1 or length(cosmetic_id) > 120 or cosmetic_id ~ '[[:cntrl:]]' or cosmetic_owned <> 'true'::jsonb then raise exception 'AI_TRADE_INVALID_COSMETIC'; end if;
    if coalesce(s_cosmetics -> cosmetic_id, 'false'::jsonb) <> 'true'::jsonb then raise exception 'AI_TRADE_MISSING_COSMETIC:%', cosmetic_id; end if;
    if coalesce(b_cosmetics -> cosmetic_id, 'false'::jsonb) = 'true'::jsonb then raise exception 'AI_TRADE_DUPLICATE_COSMETIC:%', cosmetic_id; end if;
  end loop;
  for cosmetic_id,cosmetic_owned in select key,value from jsonb_each(requested_cosmetics) loop
    if length(cosmetic_id) < 1 or length(cosmetic_id) > 120 or cosmetic_id ~ '[[:cntrl:]]' or cosmetic_owned <> 'true'::jsonb then raise exception 'AI_TRADE_INVALID_COSMETIC'; end if;
    if coalesce(b_cosmetics -> cosmetic_id, 'false'::jsonb) <> 'true'::jsonb then raise exception 'AI_TRADE_MISSING_COSMETIC:%', cosmetic_id; end if;
    if coalesce(s_cosmetics -> cosmetic_id, 'false'::jsonb) = 'true'::jsonb then raise exception 'AI_TRADE_DUPLICATE_COSMETIC:%', cosmetic_id; end if;
  end loop;

  for k,n in select key, value::text::bigint from jsonb_each_text(offered_items) loop
    s_inventory := public.trade_jsonb_adjust(s_inventory, string_to_array(k, ':'), -n);
    b_inventory := public.trade_jsonb_adjust(b_inventory, string_to_array(k, ':'), n);
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(requested_items) loop
    b_inventory := public.trade_jsonb_adjust(b_inventory, string_to_array(k, ':'), -n);
    s_inventory := public.trade_jsonb_adjust(s_inventory, string_to_array(k, ':'), n);
  end loop;

  for cosmetic_id in select key from jsonb_each(offered_cosmetics) loop
    s_cosmetics := s_cosmetics - cosmetic_id;
    b_cosmetics := jsonb_set(b_cosmetics, array[cosmetic_id], 'true'::jsonb, true);
  end loop;
  for cosmetic_id in select key from jsonb_each(requested_cosmetics) loop
    b_cosmetics := b_cosmetics - cosmetic_id;
    s_cosmetics := jsonb_set(s_cosmetics, array[cosmetic_id], 'true'::jsonb, true);
  end loop;

  update public.ai_accounts set
    coins = coins - offered_coins + requested_coins,
    player_xp = player_xp - offered_xp + requested_xp,
    inventory_items = s_inventory,
    trade_cosmetics = s_cosmetics,
    updated_at = now()
  where account_id = o.seller_ai_id;
  update public.ai_accounts set
    coins = coins + offered_coins - requested_coins,
    player_xp = player_xp + offered_xp - requested_xp,
    inventory_items = b_inventory,
    trade_cosmetics = b_cosmetics,
    updated_at = now()
  where account_id = p_buyer_ai_id;
  update public.ai_trade_offers set status = 'completed', completed_at = now() where id = o.id;
  insert into public.ai_trade_history(offer_id,seller_ai_id,buyer_ai_id,offered_assets,requested_assets,offered_value,requested_value)
  values(o.id,o.seller_ai_id,p_buyer_ai_id,o.offered_assets,o.requested_assets,o.estimated_offered_value,o.estimated_requested_value);
  return jsonb_build_object('ok',true,'offer_id',o.id,'seller_ai_id',o.seller_ai_id,'buyer_ai_id',p_buyer_ai_id);
end;
$$;
revoke all on function public.settle_ai_trade(uuid, integer) from public, anon, authenticated;
grant execute on function public.settle_ai_trade(uuid, integer) to service_role;
