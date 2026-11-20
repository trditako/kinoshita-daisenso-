-- KWL IJL-style match presentation flow.
-- Timed stages are server-authoritative; only the operator can advance them.
create or replace function public.kwl_set_match_phase(
  p_match_id bigint,
  p_actor_id text,
  p_phase text,
  p_game_number integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  m public.kwl_matches%rowtype;
  tour_status text;
  phase_seconds integer;
  game_no integer;
  old_phase text;
begin
  if p_actor_id is distinct from 'cd19b245-1a70-45de-9bb7-967f6c568425' then
    raise exception 'KWL運営者のみ実行できます';
  end if;
  if p_phase not in ('intro','draft','live','result','break') then
    raise exception '大会進行フェーズが不正です';
  end if;
  select * into m from public.kwl_matches where id=p_match_id for update;
  if not found then raise exception '対戦カードが見つかりません'; end if;
  select status into tour_status from public.kwl_tournaments where tournament_key=m.tournament_key for update;
  if tour_status='paused' then raise exception '大会は緊急停止中です'; end if;
  old_phase := coalesce(m.live_state->'presentation'->>'phase','pending');

  if p_phase='intro' and (m.status<>'ready' or exists(select 1 from public.kwl_games where match_id=p_match_id)) then
    raise exception 'チーム紹介を開始できる状態ではありません';
  elsif p_phase='draft' and m.status not in ('ready','live') then
    raise exception '選手選択・編成を開始できる状態ではありません';
  elsif p_phase='live' then
    if m.status<>'live' then raise exception '対戦カードがまだ開始されていません'; end if;
    game_no := coalesce(p_game_number,(select min(game_number) from public.kwl_games where match_id=p_match_id and status in ('ready','live')));
    if game_no is null or (select count(*) from public.kwl_game_players where match_id=p_match_id and game_number=game_no)<>2 then
      raise exception '両チームの出場選手登録が完了していません';
    end if;
    update public.kwl_games set status='live',started_at=coalesce(started_at,now())
      where match_id=p_match_id and game_number=game_no;
  elsif p_phase in ('result','break') and m.status<>'completed' then
    raise exception 'シリーズ終了後に実行できます';
  end if;

  if p_phase='intro' and old_phase not in ('pending','break') then
    raise exception '現在の進行状態からチーム紹介へ戻せません';
  elsif p_phase='draft' and old_phase not in ('intro','draft','result') then
    raise exception '現在の進行状態から選手選択へ移動できません';
  elsif p_phase='live' and old_phase<>'draft' then
    raise exception '選手選択・編成の後に試合を開始してください';
  elsif p_phase='break' and old_phase<>'result' then
    raise exception '結果発表の後に休憩へ移動してください';
  end if;

  phase_seconds := case p_phase when 'intro' then 60 when 'draft' then 90 when 'result' then 30 when 'break' then 300 else null end;
  if p_phase='draft' and game_no is null then
    game_no := coalesce((select max(game_number) from public.kwl_games where match_id=p_match_id),0)+1;
  end if;
  update public.kwl_matches
  set live_state=jsonb_set(
    coalesce(live_state,'{}'::jsonb),
    '{presentation}',
    jsonb_build_object(
      'phase',p_phase,
      'game_number',game_no,
      'phase_started_at',now(),
      'phase_ends_at',case when phase_seconds is null then null else now()+make_interval(secs=>phase_seconds) end
    ),
    true
  ),
  updated_at=now()
  where id=p_match_id;

  insert into public.kwl_live_events(tournament_key,match_id,game_number,event_type,player_name,message,payload)
  values(
    m.tournament_key,p_match_id,game_no,'system','大会進行',
    case p_phase when 'intro' then 'チーム紹介を開始しました（60秒）'
      when 'draft' then '選手選択・編成を開始しました（90秒）'
      when 'live' then '第'||game_no||'試合を開始しました'
      when 'result' then 'BO5シリーズの結果を発表します'
      else '次ラウンドまでの休憩に入りました（5分）' end,
    jsonb_build_object('phase',p_phase,'game_number',game_no,'duration_seconds',phase_seconds)
  );
  return jsonb_build_object('success',true,'phase',p_phase,'game_number',game_no,'duration_seconds',phase_seconds);
end
$function$;

-- Enforce the selection window at the database boundary, not only in the UI.
create or replace function public.kwl_guard_player_selection_phase()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare
  presentation jsonb;
  phase_end timestamptz;
begin
  select live_state->'presentation' into presentation
  from public.kwl_matches where id=new.match_id;
  if coalesce(presentation->>'phase','')<>'draft' then
    raise exception '現在は選手選択・編成の時間ではありません';
  end if;
  phase_end := nullif(presentation->>'phase_ends_at','')::timestamptz;
  if phase_end is not null and phase_end<now() then
    raise exception '選手選択・編成の制限時間が終了しました';
  end if;
  return new;
end
$function$;
drop trigger if exists kwl_game_players_phase_guard on public.kwl_game_players;
create trigger kwl_game_players_phase_guard
before insert on public.kwl_game_players
for each row execute function public.kwl_guard_player_selection_phase();

-- Character deployment locks can only be recorded after the operator starts the battle.
create or replace function public.kwl_guard_character_live_phase()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare phase text;
begin
  select live_state->'presentation'->>'phase' into phase
  from public.kwl_matches where id=new.match_id;
  if coalesce(phase,'')<>'live' then
    raise exception '大会運営が試合を開始するまでキャラクターを出撃できません';
  end if;
  return new;
end
$function$;
drop trigger if exists kwl_character_locks_phase_guard on public.kwl_character_locks;
create trigger kwl_character_locks_phase_guard
before insert on public.kwl_character_locks
for each row execute function public.kwl_guard_character_live_phase();

-- After each game, automatically open the next 90-second draft window.
create or replace function public.kwl_advance_presentation_after_game()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare
  m public.kwl_matches%rowtype;
  w1 integer;
  w2 integer;
  next_phase text;
  next_game integer;
  seconds integer;
begin
  if old.status='completed' or new.status<>'completed' then return new; end if;
  select * into m from public.kwl_matches where id=new.match_id for update;
  if not found then return new; end if;
  select count(*) filter(where winner_team_id=m.team1_id),
         count(*) filter(where winner_team_id=m.team2_id)
    into w1,w2 from public.kwl_games where match_id=new.match_id and status='completed';
  if w1>=3 or w2>=3 then
    next_phase:='result'; seconds:=30; next_game:=new.game_number;
  else
    next_phase:='draft'; seconds:=90; next_game:=new.game_number+1;
  end if;
  update public.kwl_matches
  set live_state=jsonb_set(
    coalesce(live_state,'{}'::jsonb),
    '{presentation}',
    jsonb_build_object(
      'phase',next_phase,
      'game_number',next_game,
      'phase_started_at',now(),
      'phase_ends_at',now()+make_interval(secs=>seconds)
    ),
    true
  ),
  updated_at=now()
  where id=new.match_id;
  insert into public.kwl_live_events(tournament_key,match_id,game_number,event_type,player_name,message,payload)
  values(m.tournament_key,new.match_id,next_game,'system','大会進行',
    case when next_phase='result' then 'BO5シリーズが終了しました。結果発表へ進みます'
      else '次のゲームの選手選択・編成を開始しました（90秒）' end,
    jsonb_build_object('phase',next_phase,'game_number',next_game,'duration_seconds',seconds,'team1_wins',w1,'team2_wins',w2));
  return new;
end
$function$;
drop trigger if exists kwl_game_result_presentation_advance on public.kwl_games;
create trigger kwl_game_result_presentation_advance
after update of status on public.kwl_games
for each row execute function public.kwl_advance_presentation_after_game();

revoke all on function public.kwl_set_match_phase(bigint,text,text,integer) from public;
grant execute on function public.kwl_set_match_phase(bigint,text,text,integer) to anon,authenticated;
