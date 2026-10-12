-- Public clients may read the current world announcement, but only a server-side
-- Edge Function using the service-role key may publish or clear it.
create table if not exists public.world_announcements (
  id integer primary key default 1 check (id = 1),
  message text not null default '' check (char_length(message) <= 300),
  active boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'operator'
);

alter table public.world_announcements enable row level security;
revoke all on table public.world_announcements from anon, authenticated;
grant select on table public.world_announcements to anon, authenticated;
grant all on table public.world_announcements to service_role;

drop policy if exists "world announcements are publicly readable" on public.world_announcements;
create policy "world announcements are publicly readable"
  on public.world_announcements
  for select
  to anon, authenticated
  using (true);

-- Operator-issued rewards are kept separate from rank-season rewards.
alter table public.player_rankings
  add column if not exists operator_pending_coins bigint not null default 0 check (operator_pending_coins >= 0),
  add column if not exists operator_pending_xp bigint not null default 0 check (operator_pending_xp >= 0),
  add column if not exists operator_pending_ref text not null default '';

create table if not exists public.world_operator_state (
  id integer primary key default 1 check (id = 1),
  event_name text not null default '',
  event_active boolean not null default false,
  event_expires_at timestamptz,
  maintenance_active boolean not null default false,
  maintenance_message text not null default 'メンテナンスのお知らせ：運営からの案内をご確認ください。',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'operator',
  check (char_length(event_name) <= 60),
  check (char_length(maintenance_message) <= 300)
);

alter table public.world_operator_state enable row level security;
revoke all on table public.world_operator_state from anon, authenticated;
grant select on table public.world_operator_state to anon, authenticated;
grant all on table public.world_operator_state to service_role;
drop policy if exists "world operator state is publicly readable" on public.world_operator_state;
create policy "world operator state is publicly readable"
  on public.world_operator_state for select to anon, authenticated using (true);
