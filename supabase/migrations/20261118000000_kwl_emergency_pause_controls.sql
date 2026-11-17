-- KWL operator emergency pause/resume.
alter table public.kwl_tournaments
  add column if not exists paused_from_status text,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_by text,
  add column if not exists pause_reason text;

create or replace function public.kwl_set_tournament_pause(
  p_actor_id text,
  p_paused boolean,
  p_reason text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  tour public.kwl_tournaments%rowtype;
  next_status text;
  clean_reason text := left(trim(coalesce(p_reason, '')), 120);
begin
  if p_actor_id is distinct from 'cd19b245-1a70-45de-9bb7-967f6c568425' then
    raise exception '大会運営者のみ実行できます';
  end if;

  select * into tour
  from public.kwl_tournaments
  where tournament_key = 'kwl-2026-01'
  for update;

  if not found then
    raise exception '大会データがありません';
  end if;

  if p_paused then
    if tour.status = 'paused' then
      return jsonb_build_object('success', true, 'paused', true, 'already_paused', true);
    end if;
    if tour.status not in ('registration', 'drawn', 'live') then
      raise exception '現在の大会状態では緊急停止できません';
    end if;

    update public.kwl_tournaments
    set paused_from_status = status,
        status = 'paused',
        paused_at = now(),
        paused_by = p_actor_id,
        pause_reason = nullif(clean_reason, ''),
        updated_at = now()
    where tournament_key = tour.tournament_key;

    insert into public.kwl_live_events(tournament_key, event_type, player_name, message, payload)
    values (
      tour.tournament_key, 'system', '大会運営',
      '大会が運営操作により緊急停止されました',
      jsonb_build_object('action', 'pause', 'reason', clean_reason)
    );
    return jsonb_build_object('success', true, 'paused', true, 'previous_status', tour.status);
  end if;

  if tour.status <> 'paused' then
    raise exception '大会は停止されていません';
  end if;

  next_status := case
    when tour.paused_from_status in ('registration', 'drawn', 'live') then tour.paused_from_status
    else 'drawn'
  end;

  update public.kwl_tournaments
  set status = next_status,
      paused_from_status = null,
      paused_at = null,
      paused_by = null,
      pause_reason = null,
      updated_at = now()
  where tournament_key = tour.tournament_key;

  insert into public.kwl_live_events(tournament_key, event_type, player_name, message, payload)
  values (
    tour.tournament_key, 'system', '大会運営',
    '大会が運営操作により再開されました',
    jsonb_build_object('action', 'resume', 'restored_status', next_status)
  );
  return jsonb_build_object('success', true, 'paused', false, 'restored_status', next_status);
end
$function$;

revoke all on function public.kwl_set_tournament_pause(text, boolean, text) from public;
grant execute on function public.kwl_set_tournament_pause(text, boolean, text) to anon, authenticated;

create or replace function public.kwl_lock_character(
  p_match_id bigint,
  p_game_number integer,
  p_team_id bigint,
  p_player_id text,
  p_player_type text,
  p_character_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  gp public.kwl_game_players%rowtype;
  m public.kwl_matches%rowtype;
  g public.kwl_games%rowtype;
  tour_status text;
begin
  if coalesce(trim(p_character_key), '') = '' then
    raise exception 'キャラクター情報が不正です';
  end if;

  select * into m from public.kwl_matches where id = p_match_id;
  if not found then raise exception '試合が見つかりません'; end if;

  select status into tour_status
  from public.kwl_tournaments
  where tournament_key = m.tournament_key
  for update;
  if tour_status = 'paused' then raise exception '大会は緊急停止中です'; end if;

  select * into g
  from public.kwl_games
  where match_id = p_match_id and game_number = p_game_number
  for update;
  if not found or g.status not in ('ready', 'live') then
    raise exception '両チームの出場登録が完了していません';
  end if;

  select * into gp
  from public.kwl_game_players
  where match_id = p_match_id and game_number = p_game_number
    and team_id = p_team_id and player_id = p_player_id and player_type = p_player_type;
  if not found then raise exception '先にこの試合への出場登録をしてください'; end if;

  if exists (
    select 1 from public.kwl_character_locks
    where match_id = p_match_id and team_id = p_team_id and character_key = p_character_key
  ) then
    raise exception 'このキャラクターは同じ対戦カードの前の試合ですでに使用されています';
  end if;

  insert into public.kwl_character_locks(
    match_id, team_id, character_key, first_game_number, player_id, player_type
  ) values (
    p_match_id, p_team_id, p_character_key, p_game_number, p_player_id, p_player_type
  );

  update public.kwl_games set status = 'live'
  where match_id = p_match_id and game_number = p_game_number;

  insert into public.kwl_live_events(
    tournament_key, match_id, game_number, event_type, team_id, player_name, message, payload
  ) values (
    m.tournament_key, p_match_id, p_game_number, 'deployment', p_team_id, gp.player_name,
    gp.player_name || ' が ' || p_character_key || ' を出撃させました',
    jsonb_build_object('character', p_character_key)
  );
  return jsonb_build_object('success', true, 'character_key', p_character_key);
end
$function$;

create or replace function public.kwl_record_game_result(
  p_match_id bigint,
  p_game_number integer,
  p_winner_team_id bigint,
  p_reporter_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  m public.kwl_matches%rowtype;
  g public.kwl_games%rowtype;
  tour_status text;
  w1 integer;
  w2 integer;
  complete_series boolean;
begin
  select * into m from public.kwl_matches where id = p_match_id for update;
  if not found then raise exception '試合結果を確定できません'; end if;

  select status into tour_status
  from public.kwl_tournaments
  where tournament_key = m.tournament_key
  for update;
  if tour_status = 'paused' then
    raise exception '大会は緊急停止中のため、試合結果を確定できません';
  end if;

  if p_winner_team_id not in (m.team1_id, m.team2_id) then
    raise exception '勝者チームが不正です';
  end if;

  select * into g
  from public.kwl_games
  where match_id = p_match_id and game_number = p_game_number
  for update;
  if not found then raise exception 'このゲームは未登録です'; end if;

  if g.status = 'completed' then
    if g.winner_team_id = p_winner_team_id then
      select
        count(*) filter (where winner_team_id = m.team1_id),
        count(*) filter (where winner_team_id = m.team2_id)
      into w1, w2
      from public.kwl_games
      where match_id = p_match_id and status = 'completed';
      return jsonb_build_object(
        'success', true, 'already_recorded', true,
        'team1_wins', w1, 'team2_wins', w2,
        'series_completed', (w1 >= 3 or w2 >= 3),
        'winner_team_id', case when w1 >= 3 then m.team1_id when w2 >= 3 then m.team2_id else null end
      );
    end if;
    raise exception 'このゲームの勝敗はすでに確定しています';
  end if;

  if m.status not in ('live', 'ready') then raise exception '試合結果を確定できません'; end if;
  if (select count(*) from public.kwl_game_players where match_id = p_match_id and game_number = p_game_number) <> 2 then
    raise exception '両チームの出場選手登録が必要です';
  end if;

  update public.kwl_games
  set status = 'completed', winner_team_id = p_winner_team_id, completed_at = now()
  where match_id = p_match_id and game_number = p_game_number;

  select
    count(*) filter (where winner_team_id = m.team1_id),
    count(*) filter (where winner_team_id = m.team2_id)
  into w1, w2
  from public.kwl_games
  where match_id = p_match_id and status = 'completed';

  update public.kwl_matches
  set team1_wins = w1, team2_wins = w2, updated_at = now()
  where id = p_match_id;

  complete_series := (w1 >= 3 or w2 >= 3);
  if complete_series then
    update public.kwl_matches
    set winner_team_id = case when w1 >= 3 then m.team1_id else m.team2_id end,
        status = 'completed', updated_at = now()
    where id = p_match_id;

    if m.next_round_number is not null and m.next_match_number is not null then
      update public.kwl_matches
      set team1_id = case when m.next_slot = 1 then case when w1 >= 3 then m.team1_id else m.team2_id end else team1_id end,
          team2_id = case when m.next_slot = 2 then case when w1 >= 3 then m.team1_id else m.team2_id end else team2_id end,
          status = case
            when (case when m.next_slot = 1 then true else team1_id is not null end)
             and (case when m.next_slot = 2 then true else team2_id is not null end)
            then 'ready' else status end,
          updated_at = now()
      where tournament_key = m.tournament_key
        and round_number = m.next_round_number
        and match_number = m.next_match_number;
    end if;
  end if;

  insert into public.kwl_live_events(
    tournament_key, match_id, game_number, event_type, team_id, message, payload
  ) values (
    m.tournament_key, p_match_id, p_game_number, 'score', p_winner_team_id,
    '第' || p_game_number || '試合終了：' || w1 || ' - ' || w2,
    jsonb_build_object('team1_wins', w1, 'team2_wins', w2, 'series_completed', complete_series)
  );

  return jsonb_build_object(
    'success', true, 'team1_wins', w1, 'team2_wins', w2,
    'series_completed', complete_series,
    'winner_team_id', case when complete_series then case when w1 >= 3 then m.team1_id else m.team2_id end else null end
  );
end
$function$;
