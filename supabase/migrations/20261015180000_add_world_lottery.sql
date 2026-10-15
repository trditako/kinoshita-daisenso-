create table if not exists public.world_lottery_tickets (
 id uuid primary key default gen_random_uuid(),
 ticket_number char(6) not null unique check(ticket_number ~ '^[0-9]{6}$'),
 owner_type text not null check(owner_type in ('player','ai')),
 owner_id text not null,
 owner_name text not null default '',
 issued_by text not null default 'operator',
 created_at timestamptz not null default now(),
 draw_id uuid,
 prize_tier text check(prize_tier in ('1','2','3')),
 reward_granted boolean not null default false,
 reward_result jsonb not null default '{}'::jsonb
);
create index if not exists world_lottery_tickets_owner_idx on public.world_lottery_tickets(owner_type,owner_id,created_at desc);
create index if not exists world_lottery_tickets_draw_idx on public.world_lottery_tickets(draw_id,prize_tier);
create table if not exists public.world_lottery_draws (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(title) between 1 and 60),
 winning_number char(6) not null check(winning_number ~ '^[0-9]{6}$'),
 prizes jsonb not null default '{}'::jsonb,
 published_at timestamptz not null default now(),
 published_by text not null default 'operator',
 ticket_count integer not null default 0,
 winner_counts jsonb not null default '{"1":0,"2":0,"3":0}'::jsonb,
 awarded_count integer not null default 0
);
alter table public.player_rankings add column if not exists operator_pending_lottery_rewards jsonb not null default '[]'::jsonb;
alter table public.player_rankings add column if not exists operator_pending_lottery_ref text not null default '';
alter table public.world_lottery_tickets enable row level security;
alter table public.world_lottery_draws enable row level security;
drop policy if exists world_lottery_tickets_public_read on public.world_lottery_tickets;
create policy world_lottery_tickets_public_read on public.world_lottery_tickets for select to anon,authenticated using(true);
drop policy if exists world_lottery_draws_public_read on public.world_lottery_draws;
create policy world_lottery_draws_public_read on public.world_lottery_draws for select to anon,authenticated using(true);
revoke insert,update,delete on public.world_lottery_tickets from anon,authenticated;
revoke insert,update,delete on public.world_lottery_draws from anon,authenticated;
grant select on public.world_lottery_tickets to anon,authenticated;
grant select on public.world_lottery_draws to anon,authenticated;