-- Server-authoritative daily login rewards.
-- This is deliberately separate from browser localStorage; no client-supplied balances/rewards are accepted.
create table if not exists public.game_wallet_daily_claims (
  user_id uuid not null references public.trade_profiles(user_id) on delete cascade,
  claim_date date not null,
  reward_day smallint not null check (reward_day between 1 and 7),
  coins bigint not null check (coins >= 0),
  xp bigint not null check (xp >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, claim_date)
);

alter table public.game_wallet_daily_claims enable row level security;
revoke all on public.game_wallet_daily_claims from public, anon, authenticated;
grant select, insert on public.game_wallet_daily_claims to service_role;

create or replace function public.claim_game_daily_login(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_day integer;
  v_coins bigint;
  v_xp bigint;
  v_claim public.game_wallet_daily_claims%rowtype;
  v_profile public.trade_profiles%rowtype;
begin
  if p_user_id is null then raise exception 'INVALID_USER'; end if;

  insert into public.trade_profiles(user_id, display_name)
  values (p_user_id, 'プレイヤー')
  on conflict (user_id) do nothing;

  select * into v_profile from public.trade_profiles
    where user_id = p_user_id for update;
  if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;

  -- Keep the existing game's Japan-time seven-day rotation exactly:
  -- numeric YYYYMMDD modulo 7, then zero-based day = (n % 7).
  v_day := mod((to_char(v_today, 'YYYYMMDD'))::integer, 7);
  case v_day
    when 0 then v_coins := 300;  v_xp := 0;
    when 1 then v_coins := 500;  v_xp := 0;
    when 2 then v_coins := 700;  v_xp := 500;
    when 3 then v_coins := 1000; v_xp := 500;
    when 4 then v_coins := 1500; v_xp := 1000;
    when 5 then v_coins := 2000; v_xp := 1500;
    else v_coins := 3000; v_xp := 3000;
  end case;

  insert into public.game_wallet_daily_claims(user_id, claim_date, reward_day, coins, xp)
  values (p_user_id, v_today, v_day + 1, v_coins, v_xp)
  on conflict (user_id, claim_date) do nothing
  returning * into v_claim;

  if not found then
    select * into v_profile from public.trade_profiles where user_id = p_user_id;
    return jsonb_build_object(
      'claimed', false, 'claim_date', v_today, 'profile', to_jsonb(v_profile)
    );
  end if;

  update public.trade_profiles
    set coins = coins + v_coins,
        xp = xp + v_xp,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_profile;

  return jsonb_build_object(
    'claimed', true,
    'claim_date', v_today,
    'reward', jsonb_build_object('day', v_day + 1, 'coins', v_coins, 'xp', v_xp),
    'profile', to_jsonb(v_profile)
  );
end;
$$;

revoke all on function public.claim_game_daily_login(uuid) from public, anon, authenticated;
grant execute on function public.claim_game_daily_login(uuid) to service_role;
