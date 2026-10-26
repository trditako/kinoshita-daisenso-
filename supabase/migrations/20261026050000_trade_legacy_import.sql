-- One-time legacy import for the trading UI. The caller may import only once per auth account.
-- Browser-held game data cannot be cryptographically verified; after this one-time claim,
-- all trade reservations and settlements use the server-side profile as the source of truth.
create or replace function public.claim_legacy_trade_assets(p_user_id uuid, p_assets jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.trade_profiles%rowtype;
  k text;
  v text;
  n bigint;
  v_coins bigint;
  v_xp bigint;
  v_items jsonb;
  v_cosmetics jsonb;
begin
  select * into p from public.trade_profiles where user_id = p_user_id for update;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;
  if p.legacy_claimed_at is not null then raise exception 'LEGACY_ALREADY_CLAIMED'; end if;
  if p.coins <> 0 or p.xp <> 0 or p.inventory <> '{}'::jsonb or p.cosmetics <> '{}'::jsonb then
    raise exception 'TRADE_PROFILE_NOT_EMPTY';
  end if;
  if jsonb_typeof(p_assets) <> 'object'
     or jsonb_typeof(coalesce(p_assets->'items','{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_assets->'cosmetics','{}'::jsonb)) <> 'object'
     or coalesce(p_assets->>'coins','') !~ '^[0-9]{1,10}$'
     or coalesce(p_assets->>'xp','') !~ '^[0-9]{1,10}$' then
    raise exception 'INVALID_LEGACY_ASSETS';
  end if;
  v_coins := (p_assets->>'coins')::bigint;
  v_xp := (p_assets->>'xp')::bigint;
  if v_coins > 1000000000 or v_xp > 1000000000 then raise exception 'INVALID_LEGACY_ASSETS'; end if;
  v_items := coalesce(p_assets->'items','{}'::jsonb);
  v_cosmetics := coalesce(p_assets->'cosmetics','{}'::jsonb);
  for k,v in select key,value from jsonb_each_text(v_items) loop
    if length(k) < 1 or length(k) > 100 or v !~ '^[0-9]{1,6}$' then raise exception 'INVALID_LEGACY_ASSETS'; end if;
    n := v::bigint;
    if n < 1 or n > 100000 then raise exception 'INVALID_LEGACY_ASSETS'; end if;
  end loop;
  for k,v in select key,value from jsonb_each_text(v_cosmetics) loop
    if length(k) < 1 or length(k) > 120 or v <> '1' then raise exception 'INVALID_LEGACY_ASSETS'; end if;
  end loop;
  update public.trade_profiles
  set coins=v_coins, xp=v_xp, inventory=v_items, cosmetics=v_cosmetics,
      legacy_claimed_at=now(), updated_at=now()
  where user_id=p_user_id;
  return jsonb_build_object('ok',true,'legacy_claimed_at',now());
end;
$$;
revoke all on function public.claim_legacy_trade_assets(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.claim_legacy_trade_assets(uuid,jsonb) to service_role;
