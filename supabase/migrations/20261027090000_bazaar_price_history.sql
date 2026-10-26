create table if not exists public.bazaar_price_history (
  asset_type text not null check (asset_type in ('item','cosmetic')),
  asset_id text not null check (length(asset_id) between 1 and 120),
  snapshot_date date not null,
  estimated_value bigint not null check (estimated_value >= 1),
  demand_multiplier numeric not null default 1 check (demand_multiplier between 0.65 and 2.5),
  created_at timestamptz not null default now(),
  primary key (asset_type, asset_id, snapshot_date)
);
create index if not exists bazaar_price_history_date_idx
  on public.bazaar_price_history (snapshot_date desc);
alter table public.bazaar_price_history enable row level security;
revoke all on public.bazaar_price_history from anon, authenticated;
