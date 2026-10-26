alter table public.trade_profiles
  add column if not exists game_assets_synced_at timestamptz;

comment on column public.trade_profiles.game_assets_synced_at is
  'Timestamp for one-time import of this browser game wallet into the trading wallet. Client-side source is not tamper-proof.';
