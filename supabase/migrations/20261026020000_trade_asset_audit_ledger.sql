-- Immutable audit trail for every server-side player trade balance/ownership mutation.
-- This intentionally does not import browser localStorage: client-held values are not trusted.
create table if not exists public.trade_asset_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.trade_profiles(user_id) on delete cascade,
  asset_type text not null check (asset_type in ('coins','xp','item','cosmetic')),
  asset_id text not null,
  delta bigint not null check (delta <> 0),
  balance_after bigint not null check (balance_after >= 0),
  source text not null default 'trade_profile_update',
  created_at timestamptz not null default now()
);

create index if not exists trade_asset_ledger_user_created_idx
  on public.trade_asset_ledger (user_id, created_at desc);
create index if not exists trade_asset_ledger_asset_idx
  on public.trade_asset_ledger (asset_type, asset_id, created_at desc);

alter table public.trade_asset_ledger enable row level security;
revoke all on public.trade_asset_ledger from public, anon, authenticated;
grant select, insert on public.trade_asset_ledger to service_role;
grant usage, select on sequence public.trade_asset_ledger_id_seq to service_role;

create or replace function public.log_trade_profile_asset_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset_id text;
  v_before bigint;
  v_after bigint;
begin
  if new.coins is distinct from old.coins then
    insert into public.trade_asset_ledger(user_id, asset_type, asset_id, delta, balance_after)
    values (new.user_id, 'coins', 'coins', new.coins - old.coins, new.coins);
  end if;

  if new.xp is distinct from old.xp then
    insert into public.trade_asset_ledger(user_id, asset_type, asset_id, delta, balance_after)
    values (new.user_id, 'xp', 'xp', new.xp - old.xp, new.xp);
  end if;

  for v_asset_id in
    select k from (
      select jsonb_object_keys(coalesce(old.inventory, '{}'::jsonb)) as k
      union
      select jsonb_object_keys(coalesce(new.inventory, '{}'::jsonb)) as k
    ) as keys
  loop
    v_before := case
      when coalesce(old.inventory->>v_asset_id, '0') ~ '^-?[0-9]+$'
        then coalesce((old.inventory->>v_asset_id)::bigint, 0) else 0 end;
    v_after := case
      when coalesce(new.inventory->>v_asset_id, '0') ~ '^-?[0-9]+$'
        then coalesce((new.inventory->>v_asset_id)::bigint, 0) else 0 end;
    if v_before is distinct from v_after then
      insert into public.trade_asset_ledger(user_id, asset_type, asset_id, delta, balance_after)
      values (new.user_id, 'item', v_asset_id, v_after - v_before, v_after);
    end if;
  end loop;

  for v_asset_id in
    select k from (
      select jsonb_object_keys(coalesce(old.cosmetics, '{}'::jsonb)) as k
      union
      select jsonb_object_keys(coalesce(new.cosmetics, '{}'::jsonb)) as k
    ) as keys
  loop
    v_before := case
      when coalesce(old.cosmetics->>v_asset_id, '0') ~ '^-?[0-9]+$'
        then coalesce((old.cosmetics->>v_asset_id)::bigint, 0) else 0 end;
    v_after := case
      when coalesce(new.cosmetics->>v_asset_id, '0') ~ '^-?[0-9]+$'
        then coalesce((new.cosmetics->>v_asset_id)::bigint, 0) else 0 end;
    if v_before is distinct from v_after then
      insert into public.trade_asset_ledger(user_id, asset_type, asset_id, delta, balance_after)
      values (new.user_id, 'cosmetic', v_asset_id, v_after - v_before, v_after);
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.log_trade_profile_asset_changes() from public, anon, authenticated;

drop trigger if exists trade_profile_asset_ledger_after_update on public.trade_profiles;
create trigger trade_profile_asset_ledger_after_update
after update of coins, xp, inventory, cosmetics on public.trade_profiles
for each row execute function public.log_trade_profile_asset_changes();
