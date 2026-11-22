-- KWL IJL-style match presentation flow.
-- Timed stages are server-authoritative; only the operator can advance them.
-- Persist the entrant's selected formation for this BO5 game.
alter table public.kwl_game_players
  add column if not exists formation_snapshot jsonb not null default '[]'::jsonb;

create or replace function public.kwl_set_game_formation(
  p_match_id bigint,p_game_number integer,p_team_id bigint,p_player_id text,p_formation_snapshot jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare phase_data jsonb; clean_snapshot jsonb;
begin
  select live_state->'presentation' into phase_data
  from public.kwl_matches where id=p_match_id for update;
  if not found then raise exception '試合が見つかりません'; end if;
  if coalesce(phase_data->>'phase','')<>'draft' then
    raise exception '編成を保存できるのは選手選択・編成時間だけです';
  end if;
  if jsonb_typeof(p_formation_snapshot) is distinct from 'array' then
    raise exception '編成データは配列で指定してください';
  end if;
  if jsonb_array_length(p_formation_snapshot)<1 or jsonb_array_length(p_formation_snapshot)>10 then
    raise exception '編成は1〜10体で登録してください';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_formation_snapshot) x(value)
    where jsonb_typeof(x.value)<>'string'
       or length(coalesce(x.value#>>'{}',''))=0
       or length(x.value#>>'{}')>100
  ) then
    raise exception '編成キャラクター名が不正です';
  end if;
  select coalesce(jsonb_agg(to_jsonb(v.name) order by v.ordinality),'[]'::jsonb)
    into clean_snapshot
  from (
    select distinct on (x.value#>>'{}') x.value#>>'{}' as name,x.ordinality
    from jsonb_array_elements(p_formation_snapshot) with ordinality x(value,ordinality)
    order by x.value#>>'{}',x.ordinality
    limit 10
  ) v;
  update public.kwl_game_players set formation_snapshot=clean_snapshot
  where match_id=p_match_id and game_number=p_game_number
    and team_id=p_team_id and player_id=p_player_id and player_type='player';
  if not found then raise exception 'この試合に登録された選手情報がありません'; end if;
  return jsonb_build_object('success',true,'formation_snapshot',clean_snapshot);
end
$function$;
revoke all on function public.kwl_set_game_formation(bigint,integer,bigint,text,jsonb) from public;
grant execute on function public.kwl_set_game_formation(bigint,integer,bigint,text,jsonb) to anon,authenticated;

-- Register one unused AI roster member for each AI team at the beginning of every draft.
create or replace function public.kwl_register_ai_players_for_game(
  p_match_id bigint,p_game_number integer
) returns integer
language plpgsql
security definer
set search_path=public
as $function$
declare m public.kwl_matches%rowtype; t public.kwl_teams%rowtype; ai_id text; ai_name text; inserted_count integer:=0;
begin
  select * into m from public.kwl_matches where id=p_match_id;
  if not found then return 0; end if;
  insert into public.kwl_games(tournament_key,match_id,game_number,status)
  values(m.tournament_key,p_match_id,p_game_number,'waiting')
  on conflict(match_id,game_number) do nothing;
  for t in select * from public.kwl_teams where id in (m.team1_id,m.team2_id) and leader_type='ai'
  loop
    if exists(select 1 from public.kwl_game_players where match_id=p_match_id and team_id=t.id and game_number=p_game_number) then
      continue;
    end if;
    select x.value->>'id',coalesce(x.value->>'name',x.value->>'id') into ai_id,ai_name
    from jsonb_array_elements(t.roster) with ordinality x(value,ordinality)
    where coalesce(x.value->>'type','player')='ai'
      and coalesce(x.value->>'id','') ~ '^AI-[0-9]{1,4}$'
      and not exists(
        select 1
        from public.kwl_game_players prior
        where prior.match_id=p_match_id
          and prior.team_id=t.id
          and prior.player_type='ai'
          and prior.player_id=x.value->>'id'
      )
    order by x.ordinality
    limit 1;
    if ai_id is null then
      raise exception 'AIチーム % に次の出場可能選手がいません',t.alliance_name;
    end if;
    insert into public.kwl_game_players(match_id,game_number,team_id,player_id,player_type,player_name)
    values(p_match_id,p_game_number,t.id,ai_id,'ai',coalesce(ai_name,ai_id))
    on conflict(match_id,game_number,team_id) do nothing;
    if found then
      inserted_count:=inserted_count+1;
      insert into public.kwl_live_events(tournament_key,match_id,game_number,event_type,team_id,player_name,message,payload)
      values(m.tournament_key,p_match_id,p_game_number,'system',t.id,coalesce(ai_name,ai_id),
        coalesce(ai_name,ai_id)||'（AI）が出場登録しました',jsonb_build_object('player_id',ai_id,'player_type','ai'));
    end if;
    ai_id:=null;
    ai_name:=null;
  end loop;
  if (select count(*) from public.kwl_game_players where match_id=p_match_id and game_number=p_game_number)=2 then
    update public.kwl_matches set status='live',updated_at=now() where id=p_match_id;
  end if;
  return inserted_count;
end
$function$;
revoke all on function public.kwl_register_ai_players_for_game(bigint,integer) from public,anon,authenticated;

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
  if p_phase is null or p_phase not in ('intro','draft','live','result','break') then
    raise exception '大会進行フェーズが不正です';
  end if;
  select * into m from public.kwl_matches where id=p_match_id for update;
  if not found then raise exception '対戦カードが見つかりません'; end if;
  select status into tour_status from public.kwl_tournaments where tournament_key=m.tournament_key for update;
  if tour_status='paused' then raise exception '大会は緊急停止中です'; end if;
  old_phase := coalesce(m.live_state->'presentation'->>'phase','pending');

  if p_phase='intro' and (m.status<>'ready' or exists(select 1 from public.kwl_games where match_id=p_match_id)) then
    raise exception 'チーム紹介を開始できる状態ではありません';
  elsif p_phase='intro' and m.round_number>1 and exists(
    select 1 from public.kwl_matches prior
    where prior.tournament_key=m.tournament_key and prior.round_number=m.round_number-1
      and prior.status not in ('completed','bye')
  ) then
    raise exception '前ラウンドの全試合が終了するまで次ラウンドは開始できません';
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
  elsif p_phase='break' and exists(
    select 1 from public.kwl_matches same_round
    where same_round.tournament_key=m.tournament_key and same_round.round_number=m.round_number
      and same_round.status not in ('completed','bye')
  ) then
    raise exception 'このラウンドの全試合が終了するまで休憩へ移動できません';
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

  if p_phase='draft' then
    perform public.kwl_register_ai_players_for_game(p_match_id,game_no);
  end if;

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
  if phase_end is not null and phase_end<now() and coalesce(new.player_type,'player')<>'ai' then
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
  if next_phase='draft' then
    perform public.kwl_register_ai_players_for_game(new.match_id,next_game);
  end if;
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

      and not exists(select 1 from public.kwl_game_players prior where prior.match_id=p_match_id and prior.team_id=t.id and prior.player_type='ai' and prior.player_id=x.value->>'id')
    order by x.ordinality limit 1;
    if ai_id is null then raise exception 'AIチーム % に次の出場可能選手がいません',t.alliance_name; end if;
    insert into public.kwl_game_players(match_id,game_number,team_id,player_id,player_type,player_name)
    values(p_match_id,p_game_number,t.id,ai_id,'ai',coalesce(ai_name,ai_id))
    on conflict(match_id,game_number,team_id) do nothing;
    if found then
      inserted_count:=inserted_count+1;
      insert into public.kwl_live_events(tournament_key,match_id,game_number,event_type,team_id,player_name,message,payload)
      values(m.tournament_key,p_match_id,p_game_number,'system',t.id,coalesce(ai_name,ai_id),
        coalesce(ai_name,ai_id)||'（AI）が出場登録しました',jsonb_build_object('player_id',ai_id,'player_type','ai'));
    end if;
    ai_id:=null;ai_name:=null;
  end loop;
  if (select count(*) from public.kwl_game_players where match_id=p_match_id and game_number=p_game_number)=2 then
    update public.kwl_matches set status='live',updated_at=now() where id=p_match_id;
  end if;
  return inserted_count;
end
$function$;
revoke all on function public.kwl_register_ai_players_for_game(bigint,integer) from public,anon,authenticated;


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
  if p_phase is null or p_phase not in ('intro','draft','live','result','break') then
    raise exception '大会進行フェーズが不正です';
  end if;
  select * into m from public.kwl_matches where id=p_match_id for update;
  if not found then raise exception '対戦カードが見つかりません'; end if;
  select status into tour_status from public.kwl_tournaments where tournament_key=m.tournament_key for update;
  if tour_status='paused' then raise exception '大会は緊急停止中です'; end if;
  old_phase := coalesce(m.live_state->'presentation'->>'phase','pending');

  if p_phase='intro' and (m.status<>'ready' or exists(select 1 from public.kwl_games where match_id=p_match_id)) then
    raise exception 'チーム紹介を開始できる状態ではありません';
  elsif p_phase='intro' and m.round_number>1 and exists(
    select 1 from public.kwl_matches prior
    where prior.tournament_key=m.tournament_key and prior.round_number=m.round_number-1
      and prior.status not in ('completed','bye')
  ) then
    raise exception '前ラウンドの全試合が終了するまで次ラウンドは開始できません';
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
  elsif p_phase='break' and exists(
    select 1 from public.kwl_matches same_round
    where same_round.tournament_key=m.tournament_key and same_round.round_number=m.round_number
      and same_round.status not in ('completed','bye')
  ) then
    raise exception 'このラウンドの全試合が終了するまで休憩へ移動できません';
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

  if p_phase='draft' then
    perform public.kwl_register_ai_players_for_game(p_match_id,game_no);
  end if;

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
  if phase_end is not null and phase_end<now() and coalesce(new.player_type,'player')<>'ai' then
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
  if next_phase='draft' then
    perform public.kwl_register_ai_players_for_game(new.match_id,next_game);
  end if;
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
