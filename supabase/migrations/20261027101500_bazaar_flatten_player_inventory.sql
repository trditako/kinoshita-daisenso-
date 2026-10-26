create or replace function public.trade_flatten_inventory(p_doc jsonb, p_prefix text default '')
returns jsonb
language plpgsql
immutable
set search_path = ''
as $function$
declare
  k text;
  v jsonb;
  result jsonb := '{}'::jsonb;
  full_key text;
  qty bigint;
begin
  if jsonb_typeof(coalesce(p_doc, '{}'::jsonb)) <> 'object' then
    return '{}'::jsonb;
  end if;
  for k, v in select key, value from jsonb_each(coalesce(p_doc, '{}'::jsonb)) loop
    full_key := case when p_prefix = '' then k else p_prefix || ':' || k end;
    if jsonb_typeof(v) = 'object' then
      result := result || public.trade_flatten_inventory(v, full_key);
    elsif jsonb_typeof(v) in ('number', 'string') and (v #>> '{}') ~ '^[0-9]+$' then
      qty := (v #>> '{}')::bigint;
      if qty > 0 then result := result || jsonb_build_object(full_key, qty); end if;
    end if;
  end loop;
  return result;
end
$function$;

-- Player trade profiles use flat colon-delimited IDs so reservations and settlement
-- can address nested game inventory categories atomically.
update public.trade_profiles
set inventory = public.trade_flatten_inventory(coalesce(inventory, '{}'::jsonb)),
    updated_at = now()
where jsonb_typeof(coalesce(inventory, '{}'::jsonb)) = 'object'
  and exists (
    select 1 from jsonb_each(coalesce(inventory, '{}'::jsonb)) e
    where jsonb_typeof(e.value) = 'object'
  );

revoke all on function public.trade_flatten_inventory(jsonb, text) from public, anon, authenticated;
grant execute on function public.trade_flatten_inventory(jsonb, text) to service_role;

-- Player inventories are flattened in trade_profiles; AI inventories remain nested.
-- Keep AI-buy-order settlement consistent with the normalized player representation.
create or replace function public.settle_ai_buy_order_player(p_offer_id uuid, p_seller_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  o public.ai_trade_offers%rowtype;
  ai public.ai_accounts%rowtype;
  p public.trade_profiles%rowtype;
  k text;
  n bigint;
  pay_coins bigint;
  pay_xp bigint;
  p_inventory jsonb;
  ai_inventory jsonb;
  p_cosmetics jsonb;
  ai_cosmetics jsonb;
  v_qty bigint;
  v_reserved bigint;
  current_qty bigint;
begin
  select * into o from public.ai_trade_offers where id = p_offer_id for update;
  if not found or o.status <> 'open' then raise exception 'BAZAAR_LISTING_NOT_OPEN'; end if;
  if o.expires_at <= now() then update public.ai_trade_offers set status='expired' where id=o.id; raise exception 'BAZAAR_LISTING_EXPIRED'; end if;
  if o.buyer_ai_id is not null then raise exception 'BAZAAR_LISTING_NOT_PUBLIC'; end if;
  select * into ai from public.ai_accounts where account_id=o.seller_ai_id for update;
  if not found then raise exception 'BAZAAR_AI_SELLER_MISSING'; end if;
  select * into p from public.trade_profiles where user_id=p_seller_id for update;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;

  pay_coins := coalesce((o.offered_assets->>'coins')::bigint,0);
  pay_xp := coalesce((o.offered_assets->>'xp')::bigint,0);
  if pay_coins < 0 or pay_xp < 0 or pay_coins + pay_xp = 0
    or coalesce(o.offered_assets->'items','{}'::jsonb) <> '{}'::jsonb
    or coalesce(o.offered_assets->'cosmetics','{}'::jsonb) <> '{}'::jsonb
    or coalesce(o.requested_assets->>'coins','0')::bigint <> 0
    or coalesce(o.requested_assets->>'xp','0')::bigint <> 0
    or (coalesce(o.requested_assets->'items','{}'::jsonb) = '{}'::jsonb and coalesce(o.requested_assets->'cosmetics','{}'::jsonb) = '{}'::jsonb)
  then raise exception 'BAZAAR_UNSUPPORTED_ASSETS'; end if;
  if ai.coins < pay_coins or ai.player_xp < pay_xp then raise exception 'BAZAAR_AI_FUNDS_CHANGED'; end if;

  p_inventory := coalesce(p.inventory,'{}'::jsonb);
  ai_inventory := coalesce(ai.inventory_items,'{}'::jsonb);
  p_cosmetics := coalesce(p.cosmetics,'{}'::jsonb);
  ai_cosmetics := coalesce(ai.trade_cosmetics,'{}'::jsonb);

  for k,n in select key,value::text::bigint from jsonb_each_text(coalesce(o.requested_assets->'items','{}'::jsonb)) loop
    if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or n<1 then raise exception 'BAZAAR_INVALID_ITEM'; end if;
    current_qty := coalesce((p_inventory->>k)::bigint,0);
    if current_qty < n then raise exception 'BAZAAR_PLAYER_ITEM_UNAVAILABLE'; end if;
    select coalesce(sum(coalesce((t.offered_assets->'items'->>k)::bigint,0)),0) into v_reserved
      from public.trade_offers t where t.seller_id=p_seller_id and t.status='open' and t.expires_at>now();
    if current_qty-v_reserved < n then raise exception 'BAZAAR_PLAYER_ITEM_RESERVED'; end if;
    ai_inventory := public.trade_jsonb_adjust(ai_inventory,string_to_array(k,':'),n);
    p_inventory := case when current_qty-n=0 then p_inventory-k else jsonb_set(p_inventory,array[k],to_jsonb(current_qty-n),true) end;
  end loop;

  for k in select key from jsonb_each(coalesce(o.requested_assets->'cosmetics','{}'::jsonb)) loop
    if coalesce((o.requested_assets->'cosmetics'->>k)::boolean,false) is false then raise exception 'BAZAAR_INVALID_COSMETIC'; end if;
    if coalesce(ai_cosmetics->>k,'false')='true' then raise exception 'BAZAAR_AI_ALREADY_OWNS_COSMETIC'; end if;
    v_qty := case when jsonb_typeof(p_cosmetics->k)='number' then (p_cosmetics->>k)::bigint when coalesce(p_cosmetics->>k,'false') in ('true','1') then 1 else 0 end;
    if v_qty < 1 then raise exception 'BAZAAR_PLAYER_COSMETIC_UNAVAILABLE'; end if;
    select coalesce(sum(case when coalesce(t.offered_assets->'cosmetics'->>k,'0')='true' then 1 else coalesce(nullif(t.offered_assets->'cosmetics'->>k,''),'0')::bigint end),0) into v_reserved
      from public.trade_offers t
      where t.seller_id=p_seller_id and t.status='open' and t.expires_at>now()
        and (coalesce(t.offered_assets->'cosmetics'->>k,'0')='true' or coalesce(t.offered_assets->'cosmetics'->>k,'0') ~ '^[0-9]+$');
    if v_qty-v_reserved < 1 then raise exception 'BAZAAR_PLAYER_COSMETIC_RESERVED'; end if;
    if v_qty=1 then p_cosmetics:=p_cosmetics-k; else p_cosmetics:=jsonb_set(p_cosmetics,array[k],to_jsonb(v_qty-1),true); end if;
    ai_cosmetics:=jsonb_set(ai_cosmetics,array[k],'true'::jsonb,true);
  end loop;

  update public.ai_accounts set coins=coins-pay_coins,player_xp=player_xp-pay_xp,inventory_items=ai_inventory,trade_cosmetics=ai_cosmetics,updated_at=now() where account_id=ai.account_id;
  update public.trade_profiles set coins=coins+pay_coins,xp=xp+pay_xp,inventory=p_inventory,cosmetics=p_cosmetics,updated_at=now() where user_id=p_seller_id;
  update public.ai_trade_offers set status='completed',completed_at=now() where id=o.id;
  insert into public.bazaar_history(listing_type,listing_id,buyer_player_id,seller_ai_id,offered_assets,requested_assets)
    values('ai',o.id,p_seller_id,o.seller_ai_id,o.requested_assets,o.offered_assets);
  return jsonb_build_object('ok',true,'listing_id',o.id,'seller_type','player','buyer_type','ai');
end
$function$;
revoke all on function public.settle_ai_buy_order_player(uuid,uuid) from public, anon;
grant execute on function public.settle_ai_buy_order_player(uuid,uuid) to service_role;
