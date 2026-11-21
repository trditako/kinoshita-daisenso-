create table if not exists public.kwl_compensation_distributions (
  campaign_key text not null,
  account_type text not null check (account_type in ('player','ai')),
  account_id text not null,
  coins bigint not null check (coins >= 0),
  xp bigint not null check (xp >= 0),
  created_at timestamptz not null default now(),
  primary key (campaign_key, account_type, account_id)
);
alter table public.kwl_compensation_distributions enable row level security;
revoke all on table public.kwl_compensation_distributions from anon, authenticated;
grant all on table public.kwl_compensation_distributions to service_role;
