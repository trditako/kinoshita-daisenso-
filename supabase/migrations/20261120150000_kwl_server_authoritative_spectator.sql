create table if not exists public.kwl_spectator_battles (
  id bigserial primary key,
  tournament_key text not null references public.kwl_tournaments(tournament_key) on delete cascade,
  match_id bigint not null references public.kwl_matches(id) on delete cascade,
  game_number integer not null check (game_number between 1 and 5),
  status text not null default 'simulating' check (status in ('simulating','completed','failed')),
  worker_id text,
  lease_until timestamptz,
  engine_version text not null default 'kwl-server-replay-v1',
  winner_team_id bigint references public.kwl_teams(id),
  duration_seconds numeric(8,2),
  started_at timestamptz,
  completed_at timestamptz,
  replay jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, game_number)
);

create index if not exists kwl_spectator_battles_tournament_idx
  on public.kwl_spectator_battles (tournament_key, match_id, game_number);

alter table public.kwl_spectator_battles enable row level security;
drop policy if exists "KWL spectator replays are readable" on public.kwl_spectator_battles;
create policy "KWL spectator replays are readable"
  on public.kwl_spectator_battles for select
  to anon, authenticated
  using (true);
grant select on public.kwl_spectator_battles to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.kwl_spectator_battles from anon, authenticated;

create or replace function public.kwl_claim_spectator_battle(
  p_match_id bigint,
  p_game_number integer,
  p_worker_id text,
  p_lease_seconds integer default 180
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_key text;
  v_claimed_id bigint;
begin
  select tournament_key into v_tournament_key
  from public.kwl_matches
  where id = p_match_id and status in ('ready','live')
  for update;

  if not found then
    return false;
  end if;

  insert into public.kwl_spectator_battles (
    tournament_key, match_id, game_number, status, worker_id, lease_until, engine_version
  ) values (
    v_tournament_key, p_match_id, p_game_number, 'simulating', p_worker_id,
    now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds,180),600))),
    'kwl-server-replay-v1'
  )
  on conflict (match_id, game_number) do update
    set status = 'simulating',
        worker_id = excluded.worker_id,
        lease_until = excluded.lease_until,
        updated_at = now(),
        error = null
    where public.kwl_spectator_battles.status = 'failed'
       or public.kwl_spectator_battles.status <> 'completed'
          and (
            public.kwl_spectator_battles.lease_until is null
            or public.kwl_spectator_battles.lease_until < now()
            or public.kwl_spectator_battles.worker_id = p_worker_id
          )
  returning id into v_claimed_id;

  return v_claimed_id is not null;
end;
$$;

revoke all on function public.kwl_claim_spectator_battle(bigint,integer,text,integer) from public, anon, authenticated;
grant execute on function public.kwl_claim_spectator_battle(bigint,integer,text,integer) to service_role;
