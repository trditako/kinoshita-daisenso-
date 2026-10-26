-- Fail closed on all legacy client-supplied game identity links.
-- The old browser ranking ID was not proof of ownership, so it must not remain
-- associated with a trade account. A future linking flow must verify ownership
-- server-side before setting both player_id and player_link_verified_at.
alter table public.trade_profiles
  add column if not exists player_link_verified_at timestamptz;

update public.trade_profiles
set player_id = null,
    player_link_verified_at = null
where player_id is not null
   or player_link_verified_at is not null;

create unique index if not exists trade_profiles_verified_player_id_unique
  on public.trade_profiles (player_id)
  where player_id is not null;

alter table public.trade_profiles
  drop constraint if exists trade_profiles_player_link_verification_check;

alter table public.trade_profiles
  add constraint trade_profiles_player_link_verification_check
  check (
    (player_id is null and player_link_verified_at is null)
    or
    (player_id is not null and player_link_verified_at is not null)
  );

comment on column public.trade_profiles.player_link_verified_at is
  'Set only after a server-verified game-account ownership challenge; browser-supplied IDs alone are not proof.';
