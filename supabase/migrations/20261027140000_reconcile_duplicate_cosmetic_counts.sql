create table if not exists public.trade_cosmetic_reconciliations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reconciled_at timestamptz not null default now()
);
alter table public.trade_cosmetic_reconciliations enable row level security;
revoke all on public.trade_cosmetic_reconciliations from anon, authenticated;
create or replace function public.reconcile_trade_cosmetic_counts(p_user_id uuid, p_cosmetics jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_cosmetics jsonb;
  merged_cosmetics jsonb;
  k text;
  n bigint;
  existing_qty bigint;
begin
  if p_user_id is null or jsonb_typeof(coalesce(p_cosmetics, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_COSMETIC_RECONCILIATION';
  end if;
  perform 1 from public.trade_profiles where user_id = p_user_id for update;
  select cosmetics into current_cosmetics from public.trade_profiles where user_id = p_user_id;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;
  insert into public.trade_cosmetic_reconciliations(user_id) values (p_user_id)
    on conflict do nothing;
  if not found then
    -- INSERT ... ON CONFLICT does not set FOUND when the row already exists.
    raise exception 'COSMETIC_RECONCILIATION_ALREADY_USED';
  end if;
  merged_cosmetics := coalesce(current_cosmetics, '{}'::jsonb);
  for k,n in select key, value::text::bigint from jsonb_each_text(p_cosmetics) loop
    if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or n<0 or n>100000 then
      raise exception 'INVALID_COSMETIC_RECONCILIATION';
    end if;
    existing_qty := case
      when jsonb_typeof(merged_cosmetics->k)='number' then (merged_cosmetics->>k)::bigint
      when coalesce(merged_cosmetics->>k,'false') in ('true','1') then 1
      else 0
    end;
    if n > existing_qty then
      merged_cosmetics := jsonb_set(merged_cosmetics, array[k], to_jsonb(n), true);
    end if;
  end loop;
  update public.trade_profiles set cosmetics=merged_cosmetics, updated_at=now() where user_id=p_user_id;
  return jsonb_build_object('ok',true,'items_merged',jsonb_object_length(p_cosmetics));
end;
$$;
revoke all on function public.reconcile_trade_cosmetic_counts(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_trade_cosmetic_counts(uuid,jsonb) to service_role;
