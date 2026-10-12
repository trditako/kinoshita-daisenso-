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
