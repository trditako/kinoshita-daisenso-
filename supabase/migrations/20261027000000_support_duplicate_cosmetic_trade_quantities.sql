-- Support multiple copies of the same costume/accessory in player trades.
-- Quantities remain server-validated against the server-side trade_profiles inventory.
CREATE OR REPLACE FUNCTION public.create_trade_offer(p_seller_id uuid, p_buyer_id uuid, p_offered_assets jsonb, p_requested_assets jsonb)
 RETURNS trade_offers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or n<1 then raise exception 'INVALID_COSMETIC_AMOUNT'; end if;
    select coalesce(sum((offered_assets->'cosmetics'->>k)::bigint),0) into reserved
      from public.trade_offers where seller_id=p_seller_id and status='open' and expires_at>now();
    if coalesce((seller.cosmetics->>k)::bigint,0)-reserved < n then raise exception 'COSMETIC_ALREADY_RESERVED:%',k; end if;
  end loop;

  insert into public.trade_offers(seller_id,buyer_id,offered_assets,requested_assets)
  values(p_seller_id,p_buyer_id,p_offered_assets,p_requested_assets)
  returning * into created;
  return created;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.settle_trade(p_offer_id uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Lock both profiles in a stable order so opposite-direction trades cannot deadlock.
  perform user_id from public.trade_profiles
    where user_id in (o.seller_id, p_actor)
    order by user_id
    for update;
  select * into s from public.trade_profiles where user_id = o.seller_id;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;
  select * into b from public.trade_profiles where user_id = p_actor;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;

  -- Other active offers reserve assets too; accepting one offer cannot consume assets promised elsewhere.
  if s.coins - public.reserved_trade_asset(o.seller_id,o.id,'coins','') < coalesce((o.offered_assets->>'coins')::bigint,0)
     or s.xp - public.reserved_trade_asset(o.seller_id,o.id,'xp','') < coalesce((o.offered_assets->>'xp')::bigint,0)
     or b.coins - public.reserved_trade_asset(p_actor,o.id,'coins','') < coalesce((o.requested_assets->>'coins')::bigint,0)
     or b.xp - public.reserved_trade_asset(p_actor,o.id,'xp','') < coalesce((o.requested_assets->>'xp')::bigint,0) then
    raise exception 'INSUFFICIENT_UNRESERVED_CURRENCY';
  end if;
  -- Validate both sides before changing any balance.
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
    if n < 1 or coalesce((s.inventory->>k)::bigint,0)-public.reserved_trade_asset(o.seller_id,o.id,'item',k) < n then raise exception 'INSUFFICIENT_ITEM:%', k; end if;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'items','{}'::jsonb)) loop
    if n < 1 or coalesce((b.inventory->>k)::bigint,0)-public.reserved_trade_asset(p_actor,o.id,'item',k) < n then raise exception 'INSUFFICIENT_ITEM:%', k; end if;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.offered_assets->'cosmetics','{}'::jsonb)) loop
    if n < 1 or coalesce((s.cosmetics->>k)::bigint,0)-public.reserved_trade_asset(o.seller_id,o.id,'cosmetic',k) < n then raise exception 'INSUFFICIENT_COSMETIC:%', k; end if;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'cosmetics','{}'::jsonb)) loop
    if n < 1 or coalesce((b.cosmetics->>k)::bigint,0)-public.reserved_trade_asset(p_actor,o.id,'cosmetic',k) < n then raise exception 'INSUFFICIENT_COSMETIC:%', k; end if;
  end loop;
  -- Duplicate cosmetics/accessories are stackable and may be received by existing owners.

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
      (case when coalesce((inventory->>k)::bigint,0)-n=0 then inventory - k else jsonb_set(inventory,array[k],to_jsonb(coalesce((inventory->>k)::bigint,0)-n),true) end),
      updated_at=now() where user_id=o.seller_id;
    update public.trade_profiles set inventory=jsonb_set(inventory,array[k],to_jsonb(coalesce((inventory->>k)::bigint,0)+n),true),updated_at=now() where user_id=p_actor;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'items','{}'::jsonb)) loop
    update public.trade_profiles set inventory=(case when coalesce((inventory->>k)::bigint,0)-n=0 then inventory-k else jsonb_set(inventory,array[k],to_jsonb(coalesce((inventory->>k)::bigint,0)-n),true) end),updated_at=now() where user_id=p_actor;
    update public.trade_profiles set inventory=jsonb_set(inventory,array[k],to_jsonb(coalesce((inventory->>k)::bigint,0)+n),true),updated_at=now() where user_id=o.seller_id;
  end loop;

  -- Cosmetics are unique, non-stackable ownership keys.
  for k,n in select key,value::text::bigint from jsonb_each_text(coalesce(o.offered_assets->'cosmetics','{}'::jsonb)) loop
    update public.trade_profiles set cosmetics=(case when coalesce((cosmetics->>k)::bigint,0)-n=0 then cosmetics-k else jsonb_set(cosmetics,array[k],to_jsonb(coalesce((cosmetics->>k)::bigint,0)-n),true) end),updated_at=now() where user_id=o.seller_id;
    update public.trade_profiles set cosmetics=jsonb_set(cosmetics,array[k],to_jsonb(coalesce((cosmetics->>k)::bigint,0)+n),true),updated_at=now() where user_id=p_actor;
  end loop;
  for k,n in select key,value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'cosmetics','{}'::jsonb)) loop
    update public.trade_profiles set cosmetics=(case when coalesce((cosmetics->>k)::bigint,0)-n=0 then cosmetics-k else jsonb_set(cosmetics,array[k],to_jsonb(coalesce((cosmetics->>k)::bigint,0)-n),true) end),updated_at=now() where user_id=p_actor;
    update public.trade_profiles set cosmetics=jsonb_set(cosmetics,array[k],to_jsonb(coalesce((cosmetics->>k)::bigint,0)+n),true),updated_at=now() where user_id=o.seller_id;
  end loop;

  update public.trade_offers set status='completed', buyer_id=p_actor, completed_at=now() where id=o.id;
  insert into public.trade_history(offer_id,seller_id,buyer_id,offered_assets,requested_assets)
    values(o.id,o.seller_id,p_actor,o.offered_assets,o.requested_assets);
  return jsonb_build_object('ok',true,'offer_id',o.id,'status','completed');
end;
$function$
;
