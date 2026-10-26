create table if not exists public.bazaar_history (
  id uuid primary key default gen_random_uuid(),
  listing_type text not null check (listing_type in ('player','ai')),
  listing_id uuid not null,
  seller_player_id uuid,
  buyer_player_id uuid,
  seller_ai_id integer,
  buyer_ai_id integer,
  offered_assets jsonb not null default '{}'::jsonb,
  requested_assets jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);
create index if not exists bazaar_history_player_seller_idx on public.bazaar_history(seller_player_id, completed_at desc);
create index if not exists bazaar_history_player_buyer_idx on public.bazaar_history(buyer_player_id, completed_at desc);

create or replace function public.settle_ai_trade_player(p_offer_id uuid, p_buyer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.ai_trade_offers%rowtype;
  s public.ai_accounts%rowtype;
  b public.trade_profiles%rowtype;
  k text; n bigint;
  offered_coins bigint; offered_xp bigint; requested_coins bigint; requested_xp bigint;
  offered_items jsonb; offered_cosmetics jsonb;
  s_inventory jsonb; s_cosmetics jsonb; b_inventory jsonb; b_cosmetics jsonb;
begin
  select * into o from public.ai_trade_offers where id=p_offer_id for update;
  if not found or o.status <> 'open' then raise exception 'BAZAAR_LISTING_NOT_OPEN'; end if;
  if o.expires_at <= now() then update public.ai_trade_offers set status='expired' where id=o.id; raise exception 'BAZAAR_LISTING_EXPIRED'; end if;
  if o.buyer_ai_id is not null then raise exception 'BAZAAR_LISTING_NOT_PUBLIC'; end if;
  select * into s from public.ai_accounts where account_id=o.seller_ai_id for update;
  if not found then raise exception 'BAZAAR_AI_SELLER_MISSING'; end if;
  select * into b from public.trade_profiles where user_id=p_buyer_id for update;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;
  offered_coins:=coalesce((o.offered_assets->>'coins')::bigint,0);
  offered_xp:=coalesce((o.offered_assets->>'xp')::bigint,0);
  requested_coins:=coalesce((o.requested_assets->>'coins')::bigint,0);
  requested_xp:=coalesce((o.requested_assets->>'xp')::bigint,0);
  offered_items:=coalesce(o.offered_assets->'items','{}'::jsonb);
  offered_cosmetics:=coalesce(o.offered_assets->'cosmetics','{}'::jsonb);
  if offered_coins<>0 or offered_xp<>0 or requested_coins<0 or requested_xp<0
     or coalesce(o.requested_assets->'items','{}'::jsonb)<>'{}'::jsonb
     or coalesce(o.requested_assets->'cosmetics','{}'::jsonb)<>'{}'::jsonb
     or (requested_coins=0 and requested_xp=0)
     or jsonb_typeof(offered_items)<>'object' or jsonb_typeof(offered_cosmetics)<>'object'
  then raise exception 'BAZAAR_UNSUPPORTED_ASSETS'; end if;
  if b.coins<requested_coins or b.xp<requested_xp then raise exception 'INSUFFICIENT_CURRENCY'; end if;
  s_inventory:=coalesce(s.inventory_items,'{}'::jsonb);
  s_cosmetics:=coalesce(s.trade_cosmetics,'{}'::jsonb);
  b_inventory:=coalesce(b.inventory,'{}'::jsonb);
  b_cosmetics:=coalesce(b.cosmetics,'{}'::jsonb);
  for k,n in select key,value::text::bigint from jsonb_each_text(offered_items) loop
    if length(k)<1 or length(k)>120 or n<1 or coalesce((s_inventory #>> string_to_array(k,':'))::bigint,0)<n then raise exception 'BAZAAR_AI_ITEM_UNAVAILABLE'; end if;
    b_inventory:=jsonb_set(b_inventory,array[k],to_jsonb(coalesce((b_inventory->>k)::bigint,0)+n),true);
    s_inventory:=public.trade_jsonb_adjust(s_inventory,string_to_array(k,':'),-n);
  end loop;
  for k in select key from jsonb_each(offered_cosmetics) loop
    if coalesce(s_cosmetics->>k,'false')<>'true' or coalesce(b_cosmetics->>k,'0') in ('1','true') then raise exception 'BAZAAR_COSMETIC_UNAVAILABLE'; end if;
    s_cosmetics:=s_cosmetics-k; b_cosmetics:=jsonb_set(b_cosmetics,array[k],'true'::jsonb,true);
  end loop;
  update public.ai_accounts set coins=coins+requested_coins, player_xp=player_xp+requested_xp, inventory_items=s_inventory, trade_cosmetics=s_cosmetics, updated_at=now() where account_id=s.account_id;
  update public.trade_profiles set coins=coins-requested_coins, xp=xp-requested_xp, inventory=b_inventory, cosmetics=b_cosmetics, updated_at=now() where user_id=p_buyer_id;
  update public.ai_trade_offers set status='completed',completed_at=now() where id=o.id;
  insert into public.bazaar_history(listing_type,listing_id,buyer_player_id,seller_ai_id,offered_assets,requested_assets)
    values('ai',o.id,p_buyer_id,o.seller_ai_id,o.offered_assets,o.requested_assets);
  return jsonb_build_object('ok',true,'listing_id',o.id,'seller_type','ai');
end $$;

create or replace function public.settle_player_trade_ai(p_offer_id uuid, p_buyer_ai_id integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.trade_offers%rowtype;
  s public.trade_profiles%rowtype;
  b public.ai_accounts%rowtype;
  k text; n bigint;
  offered_coins bigint; offered_xp bigint; requested_coins bigint; requested_xp bigint;
  offered_items jsonb; offered_cosmetics jsonb;
  s_inventory jsonb; s_cosmetics jsonb; b_inventory jsonb; b_cosmetics jsonb;
begin
  select * into o from public.trade_offers where id=p_offer_id for update;
  if not found or o.status<>'open' then raise exception 'BAZAAR_LISTING_NOT_OPEN'; end if;
  if o.expires_at<=now() then update public.trade_offers set status='expired' where id=o.id; raise exception 'BAZAAR_LISTING_EXPIRED'; end if;
  if o.buyer_id is not null then raise exception 'BAZAAR_LISTING_NOT_PUBLIC'; end if;
  select * into s from public.trade_profiles where user_id=o.seller_id for update;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;
  select * into b from public.ai_accounts where account_id=p_buyer_ai_id for update;
  if not found then raise exception 'BAZAAR_AI_BUYER_MISSING'; end if;
  offered_coins:=coalesce((o.offered_assets->>'coins')::bigint,0);
  offered_xp:=coalesce((o.offered_assets->>'xp')::bigint,0);
  requested_coins:=coalesce((o.requested_assets->>'coins')::bigint,0);
  requested_xp:=coalesce((o.requested_assets->>'xp')::bigint,0);
  offered_items:=coalesce(o.offered_assets->'items','{}'::jsonb);
  offered_cosmetics:=coalesce(o.offered_assets->'cosmetics','{}'::jsonb);
  if offered_coins<>0 or offered_xp<>0 or requested_coins<0 or requested_xp<0
     or coalesce(o.requested_assets->'items','{}'::jsonb)<>'{}'::jsonb
     or coalesce(o.requested_assets->'cosmetics','{}'::jsonb)<>'{}'::jsonb
     or (requested_coins=0 and requested_xp=0)
     or jsonb_typeof(offered_items)<>'object' or jsonb_typeof(offered_cosmetics)<>'object'
  then raise exception 'BAZAAR_UNSUPPORTED_ASSETS'; end if;
  if b.coins<requested_coins or b.player_xp<requested_xp then raise exception 'INSUFFICIENT_CURRENCY'; end if;
  s_inventory:=coalesce(s.inventory,'{}'::jsonb);
  s_cosmetics:=coalesce(s.cosmetics,'{}'::jsonb);
  b_inventory:=coalesce(b.inventory_items,'{}'::jsonb);
  b_cosmetics:=coalesce(b.trade_cosmetics,'{}'::jsonb);
  for k,n in select key,value::text::bigint from jsonb_each_text(offered_items) loop
    if length(k)<1 or length(k)>120 or n<1 or coalesce((s_inventory->>k)::bigint,0)-public.reserved_trade_asset(o.seller_id,o.id,'item',k)<n then raise exception 'BAZAAR_PLAYER_ITEM_UNAVAILABLE'; end if;
    s_inventory:=case when coalesce((s_inventory->>k)::bigint,0)-n=0 then s_inventory-k else jsonb_set(s_inventory,array[k],to_jsonb(coalesce((s_inventory->>k)::bigint,0)-n),true) end;
    b_inventory:=public.trade_jsonb_adjust(b_inventory,string_to_array(k,':'),n);
  end loop;
  for k in select key from jsonb_each(offered_cosmetics) loop
    if coalesce(s_cosmetics->>k,'0') not in ('1','true') or public.reserved_trade_asset(o.seller_id,o.id,'cosmetic',k)>0 or coalesce(b_cosmetics->>k,'false')='true' then raise exception 'BAZAAR_COSMETIC_UNAVAILABLE'; end if;
    s_cosmetics:=s_cosmetics-k; b_cosmetics:=jsonb_set(b_cosmetics,array[k],'true'::jsonb,true);
  end loop;
  update public.trade_profiles set coins=coins+requested_coins,xp=xp+requested_xp,inventory=s_inventory,cosmetics=s_cosmetics,updated_at=now() where user_id=s.user_id;
  update public.ai_accounts set coins=coins-requested_coins,player_xp=player_xp-requested_xp,inventory_items=b_inventory,trade_cosmetics=b_cosmetics,updated_at=now() where account_id=b.account_id;
  update public.trade_offers set status='completed',completed_at=now() where id=o.id;
  insert into public.bazaar_history(listing_type,listing_id,seller_player_id,buyer_ai_id,offered_assets,requested_assets)
    values('player',o.id,o.seller_id,p_buyer_ai_id,o.offered_assets,o.requested_assets);
  return jsonb_build_object('ok',true,'listing_id',o.id,'buyer_type','ai');
end $$;

revoke all on function public.settle_ai_trade_player(uuid,uuid) from public, anon, authenticated;
revoke all on function public.settle_player_trade_ai(uuid,integer) from public, anon, authenticated;
grant execute on function public.settle_ai_trade_player(uuid,uuid) to service_role;
grant execute on function public.settle_player_trade_ai(uuid,integer) to service_role;
