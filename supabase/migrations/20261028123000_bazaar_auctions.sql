-- Bazaar auctions: assets are escrowed when listed, bids are escrowed in coins.
create table if not exists public.bazaar_auctions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.trade_profiles(user_id) on delete cascade,
  offered_assets jsonb not null check (jsonb_typeof(offered_assets) = 'object'),
  starting_price bigint not null check (starting_price > 0),
  highest_bid bigint not null default 0 check (highest_bid >= 0),
  highest_bidder_id uuid references public.trade_profiles(user_id),
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open','completed','cancelled','expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((highest_bid = 0 and highest_bidder_id is null) or (highest_bid > 0 and highest_bidder_id is not null))
);
create index if not exists bazaar_auctions_open_ends_idx on public.bazaar_auctions(status, ends_at desc);
create index if not exists bazaar_auctions_seller_idx on public.bazaar_auctions(seller_id, status);
alter table public.bazaar_auctions enable row level security;
revoke all on public.bazaar_auctions from anon, authenticated;
grant select, insert, update, delete on public.bazaar_auctions to service_role;

CREATE OR REPLACE FUNCTION public.bid_bazaar_auction(p_auction_id uuid, p_bidder_id uuid, p_bid bigint)
 RETURNS bazaar_auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.bazaar_auctions%rowtype; bidder public.trade_profiles%rowtype; previous public.trade_profiles%rowtype; charge bigint;
begin
  select * into a from public.bazaar_auctions where id=p_auction_id for update;
  if not found or a.status<>'open' then raise exception 'BAZAAR_AUCTION_NOT_OPEN'; end if;
  if a.ends_at<=now() then raise exception 'BAZAAR_AUCTION_ENDED'; end if;
  if a.seller_id=p_bidder_id then raise exception 'BAZAAR_AUCTION_SELF_BID'; end if;
  if p_bid < greatest(a.starting_price,a.highest_bid+1) or p_bid>1000000000 then raise exception 'BAZAAR_AUCTION_BID_TOO_LOW'; end if;
  perform 1 from public.trade_profiles where user_id=p_bidder_id for update;
  select * into bidder from public.trade_profiles where user_id=p_bidder_id;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;
  charge := case when a.highest_bidder_id=p_bidder_id then p_bid-a.highest_bid else p_bid end;
  if bidder.coins<charge then raise exception 'BAZAAR_AUCTION_INSUFFICIENT_COINS'; end if;
  if a.highest_bidder_id is not null and a.highest_bidder_id<>p_bidder_id then
    select * into previous from public.trade_profiles where user_id=a.highest_bidder_id for update;
    if found then update public.trade_profiles set coins=coins+a.highest_bid,updated_at=now() where user_id=a.highest_bidder_id; end if;
  end if;
  update public.trade_profiles set coins=coins-charge,updated_at=now() where user_id=p_bidder_id;
  update public.bazaar_auctions set highest_bid=p_bid,highest_bidder_id=p_bidder_id where id=p_auction_id returning * into a;
  return a;
end;
$function$


CREATE OR REPLACE FUNCTION public.cancel_bazaar_auction(p_auction_id uuid, p_seller_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.bazaar_auctions%rowtype; p public.trade_profiles%rowtype; k text; n bigint; items jsonb; cosmetics jsonb; qty bigint;
begin
  select * into a from public.bazaar_auctions where id=p_auction_id for update;
  if not found or a.status<>'open' then raise exception 'BAZAAR_AUCTION_NOT_OPEN'; end if;
  if a.seller_id<>p_seller_id then raise exception 'BAZAAR_AUCTION_NOT_OWNER'; end if;
  if a.highest_bidder_id is not null then raise exception 'BAZAAR_AUCTION_HAS_BIDS'; end if;
  select * into p from public.trade_profiles where user_id=p_seller_id for update;
  items:=coalesce(a.offered_assets->'items','{}'::jsonb); cosmetics:=coalesce(a.offered_assets->'cosmetics','{}'::jsonb);
  for k,n in select key,value::text::bigint from jsonb_each_text(items) loop p.inventory:=public.trade_jsonb_adjust(coalesce(p.inventory,'{}'::jsonb),string_to_array(k,':'),n); end loop;
  for k,n in select key,value::text::bigint from jsonb_each_text(cosmetics) loop
    qty:=case when jsonb_typeof(p.cosmetics->k)='number' then (p.cosmetics->>k)::bigint when coalesce(p.cosmetics->>k,'false') in ('true','1') then 1 else 0 end;
    p.cosmetics:=jsonb_set(coalesce(p.cosmetics,'{}'::jsonb),array[k],to_jsonb(qty+n),true);
  end loop;
  update public.trade_profiles set inventory=p.inventory,cosmetics=p.cosmetics,updated_at=now() where user_id=p.user_id;
  update public.bazaar_auctions set status='cancelled',completed_at=now() where id=a.id;
  return jsonb_build_object('ok',true,'status','cancelled');
end;
$function$


CREATE OR REPLACE FUNCTION public.create_bazaar_auction(p_seller_id uuid, p_offered_assets jsonb, p_starting_price bigint, p_duration_hours integer)
 RETURNS bazaar_auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.trade_profiles%rowtype;
  created public.bazaar_auctions%rowtype;
  k text; n bigint; qty bigint; item_count integer := 0; cosmetics jsonb; items jsonb; current_qty bigint;
begin
  if p_seller_id is null or p_starting_price < 1 or p_starting_price > 1000000000 or p_duration_hours < 1 or p_duration_hours > 72 then
    raise exception 'BAZAAR_AUCTION_INVALID_SETTINGS';
  end if;
  if jsonb_typeof(coalesce(p_offered_assets,'{}'::jsonb)) <> 'object'
     or coalesce((p_offered_assets->>'coins')::bigint,0) <> 0
     or coalesce((p_offered_assets->>'xp')::bigint,0) <> 0 then raise exception 'BAZAAR_AUCTION_UNSUPPORTED_ASSET'; end if;
  items := coalesce(p_offered_assets->'items','{}'::jsonb);
  cosmetics := coalesce(p_offered_assets->'cosmetics','{}'::jsonb);
  if jsonb_typeof(items)<>'object' or jsonb_typeof(cosmetics)<>'object' then raise exception 'BAZAAR_AUCTION_UNSUPPORTED_ASSET'; end if;
  select count(*) into item_count from jsonb_each(items);
  item_count := item_count + (select count(*) from jsonb_each(cosmetics));
  if item_count <> 1 then raise exception 'BAZAAR_AUCTION_ONE_ASSET_ONLY'; end if;
  perform 1 from public.trade_profiles where user_id=p_seller_id for update;
  select * into p from public.trade_profiles where user_id=p_seller_id;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;
  if (select count(*) from public.bazaar_auctions where seller_id=p_seller_id and status='open' and ends_at>now()) >= 10 then raise exception 'BAZAAR_AUCTION_LIMIT'; end if;
  for k,n in select key,value::text::bigint from jsonb_each_text(items) loop
    if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or n<1 then raise exception 'BAZAAR_AUCTION_INVALID_ITEM'; end if;
    current_qty := coalesce((p.inventory #>> string_to_array(k,':'))::bigint,0);
    if current_qty<n then raise exception 'BAZAAR_AUCTION_ITEM_UNAVAILABLE'; end if;
    p.inventory := public.trade_jsonb_adjust(coalesce(p.inventory,'{}'::jsonb),string_to_array(k,':'),-n);
  end loop;
  for k,n in select key,value::text::bigint from jsonb_each_text(cosmetics) loop
    if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or n<1 then raise exception 'BAZAAR_AUCTION_INVALID_COSMETIC'; end if;
    current_qty := case when jsonb_typeof(p.cosmetics->k)='number' then (p.cosmetics->>k)::bigint when coalesce(p.cosmetics->>k,'false') in ('true','1') then 1 else 0 end;
    if current_qty<n then raise exception 'BAZAAR_AUCTION_COSMETIC_UNAVAILABLE'; end if;
    if current_qty=n then p.cosmetics:=p.cosmetics-k; else p.cosmetics:=jsonb_set(coalesce(p.cosmetics,'{}'::jsonb),array[k],to_jsonb(current_qty-n),true); end if;
  end loop;
  update public.trade_profiles set inventory=p.inventory,cosmetics=p.cosmetics,updated_at=now() where user_id=p_seller_id;
  insert into public.bazaar_auctions(seller_id,offered_assets,starting_price,ends_at)
  values(p_seller_id,p_offered_assets,p_starting_price,now()+make_interval(hours=>p_duration_hours)) returning * into created;
  return created;
end;
$function$


CREATE OR REPLACE FUNCTION public.finalize_bazaar_auction(p_auction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.bazaar_auctions%rowtype; seller public.trade_profiles%rowtype; buyer public.trade_profiles%rowtype;
  k text; n bigint; items jsonb; cosmetics jsonb; qty bigint;
begin
  select * into a from public.bazaar_auctions where id=p_auction_id for update;
  if not found then return jsonb_build_object('ok',false,'error','NOT_FOUND'); end if;
  if a.status<>'open' or a.ends_at>now() then return jsonb_build_object('ok',true,'status',a.status); end if;
  select * into seller from public.trade_profiles where user_id=a.seller_id for update;
  if not found then update public.bazaar_auctions set status='expired',completed_at=now() where id=a.id; return jsonb_build_object('ok',false,'error','SELLER_MISSING'); end if;
  items:=coalesce(a.offered_assets->'items','{}'::jsonb); cosmetics:=coalesce(a.offered_assets->'cosmetics','{}'::jsonb);
  if a.highest_bidder_id is null then
    for k,n in select key,value::text::bigint from jsonb_each_text(items) loop seller.inventory:=public.trade_jsonb_adjust(coalesce(seller.inventory,'{}'::jsonb),string_to_array(k,':'),n); end loop;
    for k,n in select key,value::text::bigint from jsonb_each_text(cosmetics) loop
      qty:=case when jsonb_typeof(seller.cosmetics->k)='number' then (seller.cosmetics->>k)::bigint when coalesce(seller.cosmetics->>k,'false') in ('true','1') then 1 else 0 end;
      seller.cosmetics:=jsonb_set(coalesce(seller.cosmetics,'{}'::jsonb),array[k],to_jsonb(qty+n),true);
    end loop;
    update public.trade_profiles set inventory=seller.inventory,cosmetics=seller.cosmetics,updated_at=now() where user_id=seller.user_id;
    update public.bazaar_auctions set status='expired',completed_at=now() where id=a.id;
    return jsonb_build_object('ok',true,'status','expired','no_bids',true);
  end if;
  select * into buyer from public.trade_profiles where user_id=a.highest_bidder_id for update;
  if not found then
    update public.trade_profiles set coins=coins+a.highest_bid,updated_at=now() where user_id=a.highest_bidder_id;
    for k,n in select key,value::text::bigint from jsonb_each_text(items) loop seller.inventory:=public.trade_jsonb_adjust(coalesce(seller.inventory,'{}'::jsonb),string_to_array(k,':'),n); end loop;
    for k,n in select key,value::text::bigint from jsonb_each_text(cosmetics) loop seller.cosmetics:=jsonb_set(coalesce(seller.cosmetics,'{}'::jsonb),array[k],to_jsonb(n),true); end loop;
    update public.trade_profiles set inventory=seller.inventory,cosmetics=seller.cosmetics,updated_at=now() where user_id=seller.user_id;
    update public.bazaar_auctions set status='expired',completed_at=now() where id=a.id;
    return jsonb_build_object('ok',false,'error','WINNER_MISSING');
  end if;
  for k,n in select key,value::text::bigint from jsonb_each_text(items) loop buyer.inventory:=public.trade_jsonb_adjust(coalesce(buyer.inventory,'{}'::jsonb),string_to_array(k,':'),n); end loop;
  for k,n in select key,value::text::bigint from jsonb_each_text(cosmetics) loop
    qty:=case when jsonb_typeof(buyer.cosmetics->k)='number' then (buyer.cosmetics->>k)::bigint when coalesce(buyer.cosmetics->>k,'false') in ('true','1') then 1 else 0 end;
    buyer.cosmetics:=jsonb_set(coalesce(buyer.cosmetics,'{}'::jsonb),array[k],to_jsonb(qty+n),true);
  end loop;
  update public.trade_profiles set inventory=buyer.inventory,cosmetics=buyer.cosmetics,updated_at=now() where user_id=buyer.user_id;
  update public.trade_profiles set coins=coins+a.highest_bid,updated_at=now() where user_id=seller.user_id;
  update public.bazaar_auctions set status='completed',completed_at=now() where id=a.id;
  insert into public.bazaar_history(listing_type,listing_id,buyer_player_id,seller_ai_id,offered_assets,requested_assets)
    values('player_auction',a.id,a.highest_bidder_id,null,a.offered_assets,jsonb_build_object('coins',a.highest_bid));
  return jsonb_build_object('ok',true,'status','completed','winner_id',a.highest_bidder_id,'price',a.highest_bid);
end;
$function$


CREATE OR REPLACE FUNCTION public.finalize_expired_bazaar_auctions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; total integer:=0;
begin
  for r in select id from public.bazaar_auctions where status='open' and ends_at<=now() order by ends_at limit 200 loop
    perform public.finalize_bazaar_auction(r.id); total:=total+1;
  end loop;
  return total;
end;
$function$


revoke all on function public.create_bazaar_auction(uuid,jsonb,bigint,integer) from public, anon, authenticated;
revoke all on function public.bid_bazaar_auction(uuid,uuid,bigint) from public, anon, authenticated;
revoke all on function public.finalize_bazaar_auction(uuid) from public, anon, authenticated;
revoke all on function public.finalize_expired_bazaar_auctions() from public, anon, authenticated;
revoke all on function public.cancel_bazaar_auction(uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_bazaar_auction(uuid,jsonb,bigint,integer) to service_role;
grant execute on function public.bid_bazaar_auction(uuid,uuid,bigint) to service_role;
grant execute on function public.finalize_bazaar_auction(uuid) to service_role;
grant execute on function public.finalize_expired_bazaar_auctions() to service_role;
grant execute on function public.cancel_bazaar_auction(uuid,uuid) to service_role;
