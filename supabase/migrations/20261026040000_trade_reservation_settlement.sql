create or replace function public.reserved_trade_asset(
  p_user_id uuid,
  p_exclude_offer uuid,
  p_asset_type text,
  p_asset_id text default ''
) returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case p_asset_type
      when 'coins' then coalesce((offered_assets->>'coins')::bigint,0)
      when 'xp' then coalesce((offered_assets->>'xp')::bigint,0)
      when 'item' then coalesce((offered_assets->'items'->>p_asset_id)::bigint,0)
      when 'cosmetic' then coalesce((offered_assets->'cosmetics'->>p_asset_id)::bigint,0)
      else 0
    end
  ),0)::bigint
  from public.trade_offers
  where seller_id=p_user_id and id<>p_exclude_offer
    and status='open' and expires_at>now();
$$;
revoke all on function public.reserved_trade_asset(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserved_trade_asset(uuid,uuid,text,text) to service_role;

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
    if n <> 1 or coalesce((s.cosmetics->>k)::bigint,0) < 1 or public.reserved_trade_asset(o.seller_id,o.id,'cosmetic',k)>0 then raise exception 'INSUFFICIENT_COSMETIC:%', k; end if;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'cosmetics','{}'::jsonb)) loop
    if n <> 1 or coalesce((b.cosmetics->>k)::bigint,0) < 1 or public.reserved_trade_asset(p_actor,o.id,'cosmetic',k)>0 then raise exception 'INSUFFICIENT_COSMETIC:%', k; end if;
  end loop;
  for k in select key from jsonb_each(coalesce(o.offered_assets->'cosmetics','{}'::jsonb)) loop
    if coalesce((b.cosmetics->>k)::bigint,0) > 0 then raise exception 'COSMETIC_ALREADY_OWNED:%', k; end if;
  end loop;
  for k in select key from jsonb_each(coalesce(o.requested_assets->'cosmetics','{}'::jsonb)) loop
    if coalesce((s.cosmetics->>k)::bigint,0) > 0 then raise exception 'COSMETIC_ALREADY_OWNED:%', k; end if;
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
      (case when coalesce((inventory->>k)::bigint,0)-n=0 then inventory - k else jsonb_set(inventory,array[k],to_jsonb(coalesce((inventory->>k)::bigint,0)-n),true) end),
      updated_at=now() where user_id=o.seller_id;
    update public.trade_profiles set inventory=jsonb_set(inventory,array[k],to_jsonb(coalesce((inventory->>k)::bigint,0)+n),true),updated_at=now() where user_id=p_actor;
  end loop;
  for k,n in select key, value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'items','{}'::jsonb)) loop
    update public.trade_profiles set inventory=(case when coalesce((inventory->>k)::bigint,0)-n=0 then inventory-k else jsonb_set(inventory,array[k],to_jsonb(coalesce((inventory->>k)::bigint,0)-n),true) end),updated_at=now() where user_id=p_actor;
    update public.trade_profiles set inventory=jsonb_set(inventory,array[k],to_jsonb(coalesce((inventory->>k)::bigint,0)+n),true),updated_at=now() where user_id=o.seller_id;
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
