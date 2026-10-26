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
