-- Reserve assets across active offers so one balance cannot be promised repeatedly.
create or replace function public.create_trade_offer(
  p_seller_id uuid,
  p_buyer_id uuid,
  p_offered_assets jsonb,
  p_requested_assets jsonb
) returns public.trade_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  seller public.trade_profiles%rowtype;
  created public.trade_offers%rowtype;
  k text;
  n bigint;
  reserved bigint;
  reserved_coins bigint;
  reserved_xp bigint;
  active_count integer;
  items jsonb;
  cosmetics jsonb;
begin
  if p_seller_id is null or p_buyer_id = p_seller_id then raise exception 'INVALID_TRADE_PARTICIPANTS'; end if;
  if jsonb_typeof(coalesce(p_offered_assets,'{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_requested_assets,'{}'::jsonb)) <> 'object' then raise exception 'INVALID_TRADE_ASSETS'; end if;
  if p_offered_assets = '{}'::jsonb or p_requested_assets = '{}'::jsonb then raise exception 'EMPTY_TRADE_ASSETS'; end if;
  if coalesce((p_offered_assets->>'coins')::bigint,0) < 0
     or coalesce((p_offered_assets->>'xp')::bigint,0) < 0
     or coalesce((p_requested_assets->>'coins')::bigint,0) < 0
     or coalesce((p_requested_assets->>'xp')::bigint,0) < 0 then raise exception 'INVALID_ASSET_AMOUNT'; end if;
  if jsonb_typeof(coalesce(p_offered_assets->'items','{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_requested_assets->'items','{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_offered_assets->'cosmetics','{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_requested_assets->'cosmetics','{}'::jsonb)) <> 'object' then raise exception 'INVALID_TRADE_ASSETS'; end if;

  perform 1 from public.trade_profiles where user_id = p_seller_id for update;
  select * into seller from public.trade_profiles where user_id = p_seller_id;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;

  select count(*) into active_count from public.trade_offers
   where seller_id=p_seller_id and status='open' and expires_at>now();
  if active_count >= 10 then raise exception 'ACTIVE_OFFER_LIMIT'; end if;

  select coalesce(sum((offered_assets->>'coins')::bigint),0),
         coalesce(sum((offered_assets->>'xp')::bigint),0)
    into reserved_coins,reserved_xp
    from public.trade_offers
   where seller_id=p_seller_id and status='open' and expires_at>now();
  if seller.coins - reserved_coins < coalesce((p_offered_assets->>'coins')::bigint,0)
     or seller.xp - reserved_xp < coalesce((p_offered_assets->>'xp')::bigint,0) then raise exception 'INSUFFICIENT_UNRESERVED_CURRENCY'; end if;

  items := coalesce(p_offered_assets->'items','{}'::jsonb);
  for k,n in select key,value::text::bigint from jsonb_each_text(items) loop
    if length(k)<1 or length(k)>100 or k ~ '[[:cntrl:]]' or n<1 then raise exception 'INVALID_ITEM_AMOUNT'; end if;
    select coalesce(sum((offered_assets->'items'->>k)::bigint),0) into reserved
      from public.trade_offers where seller_id=p_seller_id and status='open' and expires_at>now();
    if coalesce((seller.inventory->>k)::bigint,0)-reserved < n then raise exception 'INSUFFICIENT_UNRESERVED_ITEM:%',k; end if;
  end loop;

  cosmetics := coalesce(p_offered_assets->'cosmetics','{}'::jsonb);
  for k,n in select key,value::text::bigint from jsonb_each_text(cosmetics) loop
    if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or n<>1 then raise exception 'INVALID_COSMETIC_AMOUNT'; end if;
    select coalesce(sum((offered_assets->'cosmetics'->>k)::bigint),0) into reserved
      from public.trade_offers where seller_id=p_seller_id and status='open' and expires_at>now();
    if coalesce((seller.cosmetics->>k)::bigint,0)-reserved < 1 then raise exception 'COSMETIC_ALREADY_RESERVED:%',k; end if;
  end loop;

  insert into public.trade_offers(seller_id,buyer_id,offered_assets,requested_assets)
  values(p_seller_id,p_buyer_id,p_offered_assets,p_requested_assets)
  returning * into created;
  return created;
end;
$$;
revoke all on function public.create_trade_offer(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_trade_offer(uuid,uuid,jsonb,jsonb) to service_role;
