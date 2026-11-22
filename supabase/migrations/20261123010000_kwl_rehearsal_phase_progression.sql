-- Persist the IJL-style phase-by-phase isolated KWL rehearsal state.
alter table public.kwl_rehearsal_runs
  add column if not exists phase text not null default 'team_intro'
    check (phase in ('team_intro','player_selection','simulating','live','result','break','completed','failed')),
  add column if not exists current_game_number integer not null default 1
    check (current_game_number between 1 and 5),
  add column if not exists team1_roster jsonb not null default '[]'::jsonb
    check (jsonb_typeof(team1_roster)='array'),
  add column if not exists team2_roster jsonb not null default '[]'::jsonb
    check (jsonb_typeof(team2_roster)='array'),
  add column if not exists phase_updated_at timestamptz not null default now();

alter table public.kwl_rehearsal_games
  add column if not exists team1_player_id text,
  add column if not exists team1_player_name text,
  add column if not exists team2_player_id text,
  add column if not exists team2_player_name text;

update public.kwl_rehearsal_runs
set phase=case when status='completed' then 'completed' when status='failed' then 'failed' else phase end,
    phase_updated_at=coalesce(completed_at,started_at,created_at,now())
where phase='team_intro' and (status='completed' or status='failed');

comment on column public.kwl_rehearsal_runs.phase is 'Persisted IJL-style rehearsal phase; isolated from official KWL records.';
comment on column public.kwl_rehearsal_runs.current_game_number is 'Current BO5 game number; each team uses a distinct roster member per game.';
comment on column public.kwl_rehearsal_runs.team1_roster is 'Five distinct AI player assignments for isolated rehearsal team 1.';
comment on column public.kwl_rehearsal_runs.team2_roster is 'Five distinct AI player assignments for isolated rehearsal team 2.';
