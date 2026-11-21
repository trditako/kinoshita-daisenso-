alter table public.kwl_teams
  add column if not exists match_lineup jsonb not null default '[]'::jsonb;

alter table public.kwl_teams
  drop constraint if exists kwl_teams_match_lineup_array_check;
alter table public.kwl_teams
  add constraint kwl_teams_match_lineup_array_check
  check (jsonb_typeof(match_lineup) = 'array') not valid;
alter table public.kwl_teams validate constraint kwl_teams_match_lineup_array_check;

drop function if exists public.kwl_register_team(text, bigint);
create or replace function public.kwl_register_team(
  p_tournament_key text,
  p_player_id text,
  p_alliance_id bigint,
  p_lineup jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a public.alliances%rowtype;
  t public.kwl_tournaments%rowtype;
  n integer;
  roster_json jsonb;
  normalized_lineup jsonb := '[]'::jsonb;
  e record;
  member_entry jsonb;
  game_no integer;
  player_id_value text;
  player_type_value text;
begin
  if coalesce(p_tournament_key,'')='' then raise exception '大会IDが指定されていません'; end if;
  select * into t from public.kwl_tournaments where tournament_key=p_tournament_key for update;
  if not found then raise exception '大会データがありません'; end if;
  if now()<t.entry_opens_at then raise exception 'エントリー開始前です'; end if;
  if now()>t.entry_closes_at or t.status<>'registration' then raise exception 'エントリー期間外です'; end if;
  select * into a from public.alliances where id=p_alliance_id for update;
  if not found then raise exception '同盟が見つかりません'; end if;
  if a.owner_type<>'player' or a.owner_id<>p_player_id then raise exception 'エントリーできるのは同盟リーダーのみです'; end if;
  if jsonb_typeof(a.members)<>'array' then raise exception '同盟メンバー情報が不正です'; end if;
  select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb) into roster_json
  from jsonb_array_elements(a.members) with ordinality x(value,ordinality)
  where x.ordinality<=10;
  if jsonb_array_length(roster_json)<5 then raise exception '大会には5人以上の同盟メンバーが必要です'; end if;
  if jsonb_typeof(p_lineup)<>'array' or jsonb_array_length(p_lineup)<>5 then
    raise exception '第1〜第5試合の出場選手を5人登録してください';
  end if;
  for e in select value from jsonb_array_elements(p_lineup) as x(value) loop
    if coalesce(e.value->>'game_number','') !~ '^[1-5]$' then
      raise exception '試合番号は1〜5で指定してください';
    end if;
    game_no := (e.value->>'game_number')::integer;
    player_id_value := coalesce(e.value->>'player_id','');
    player_type_value := coalesce(e.value->>'player_type','player');
    if player_id_value='' or player_type_value not in ('player','ai') then
      raise exception '出場選手の情報が不正です';
    end if;
    if exists(
      select 1 from jsonb_array_elements(normalized_lineup) x(value)
      where (x.value->>'game_number')::integer=game_no
         or (x.value->>'player_id')=player_id_value
            and coalesce(x.value->>'player_type','player')=player_type_value
    ) then raise exception '同じ選手または試合番号が重複しています'; end if;
    select x.value into member_entry
    from jsonb_array_elements(roster_json) x(value)
    where x.value->>'id'=player_id_value
      and coalesce(x.value->>'type','player')=player_type_value
    limit 1;
    if not found then raise exception '選択した選手は登録対象の同盟メンバーではありません'; end if;
    normalized_lineup := normalized_lineup || jsonb_build_array(jsonb_build_object(
      'game_number',game_no,
      'player_id',player_id_value,
      'player_type',player_type_value,
      'player_name',coalesce(nullif(member_entry->>'name',''),player_id_value)
    ));
  end loop;
  if jsonb_array_length(normalized_lineup)<>5 then raise exception '出場選手の登録が不足しています'; end if;
  if exists(select 1 from generate_series(1,5) g where not exists(
    select 1 from jsonb_array_elements(normalized_lineup) x(value)
    where (x.value->>'game_number')::integer=g
  )) then raise exception '第1〜第5試合の出場順をすべて指定してください'; end if;
  if exists(select 1 from public.kwl_teams where tournament_key=t.tournament_key and alliance_id=a.id) then
    raise exception 'この同盟は既にエントリー済みです';
  end if;
  select count(*) into n from public.kwl_teams where tournament_key=t.tournament_key;
  if n>=t.max_teams then raise exception '参加チーム数が上限に達しました'; end if;
  insert into public.kwl_teams(tournament_key,alliance_id,alliance_name,leader_id,leader_type,roster,match_lineup)
  values(t.tournament_key,a.id,a.name,a.owner_id,a.owner_type,roster_json,normalized_lineup)
  returning id into n;
  return jsonb_build_object('success',true,'team_id',n,'alliance_name',a.name,'roster',roster_json,'match_lineup',normalized_lineup);
end $function$;

create or replace function public.kwl_claim_game_player(
  p_match_id bigint,
  p_team_id bigint,
  p_player_id text,
  p_player_type text default 'player',
  p_player_name text default '',
  p_equipment_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.kwl_matches%rowtype;
  t public.kwl_teams%rowtype;
  tour public.kwl_tournaments%rowtype;
  g integer;
  member_ok boolean;
  snapshot jsonb := '{}'::jsonb;
  entry record;
  clean_ids jsonb;
  allowed_ids text[] := array[
    'iron','iron2','iron3','power1','power2','power3','heal1','heal2','heal3',
    'wave1','wave2','wave3','surge1','surge2','surge3','ward1','ward2','myth'
  ];
begin
  if coalesce(p_player_type,'') not in ('player','ai') or coalesce(trim(p_player_id),'')='' then
    raise exception '選手情報が不正です';
  end if;
  select * into m from public.kwl_matches where id=p_match_id for update;
  if not found or m.status not in ('ready','live') then raise exception 'この試合は出場受付中ではありません'; end if;
  select * into tour from public.kwl_tournaments where tournament_key=m.tournament_key for update;
  if not found or now()<tour.starts_at or tour.status not in ('drawn','live') then raise exception '大会開始前、または受付停止中です'; end if;
  if p_team_id not in (m.team1_id,m.team2_id) then raise exception 'このチームは試合に参加していません'; end if;
  select * into t from public.kwl_teams where id=p_team_id;
  if not found then raise exception 'チームが見つかりません'; end if;
  select exists(
    select 1 from jsonb_array_elements(t.roster) x
    where x.value->>'id'=p_player_id
      and coalesce(x.value->>'type','player')=p_player_type
  ) into member_ok;
  if not member_ok then raise exception '登録選手ではありません'; end if;
  if jsonb_typeof(p_equipment_snapshot)='object' then
    for entry in select key,value from jsonb_each(p_equipment_snapshot) limit 250 loop
      if length(entry.key)<=128 and jsonb_typeof(entry.value)='array' then
        select coalesce(jsonb_agg(x.item),'[]'::jsonb) into clean_ids
        from (
          select distinct v as item from jsonb_array_elements_text(entry.value) as a(v)
          where v=any(allowed_ids) limit 6
        ) x;
        snapshot := snapshot || jsonb_build_object(entry.key,clean_ids);
      end if;
    end loop;
  end if;
  if exists(
    select 1 from public.kwl_game_players
    where match_id=p_match_id and team_id=p_team_id
      and player_type=p_player_type and player_id=p_player_id
  ) then raise exception 'この選手はこのBO5シリーズですでに出場しています'; end if;
  select x.game_number into g
  from public.kwl_games x
  where x.match_id=p_match_id and x.game_number<=5
    and not exists(
      select 1 from public.kwl_game_players gp
      where gp.match_id=x.match_id and gp.game_number=x.game_number and gp.team_id=p_team_id
    )
  order by x.game_number limit 1;
  if g is null then
    select coalesce(max(game_number),0)+1 into g from public.kwl_games where match_id=p_match_id;
    if g>5 then raise exception 'BO5の全試合枠が終了しています'; end if;
    insert into public.kwl_games(tournament_key,match_id,game_number,status)
    values(m.tournament_key,p_match_id,g,'waiting') on conflict(match_id,game_number) do nothing;
  end if;
  if jsonb_typeof(t.match_lineup)<>'array' or jsonb_array_length(t.match_lineup)<>5 then
    raise exception 'このチームの事前出場登録がありません';
  end if;
  select exists(
    select 1 from jsonb_array_elements(t.match_lineup) x
    where (x.value->>'game_number')::integer=g
      and x.value->>'player_id'=p_player_id
      and coalesce(x.value->>'player_type','player')=p_player_type
  ) into member_ok;
  if not member_ok then raise exception 'この試合の出場予定選手として登録されていません'; end if;
  insert into public.kwl_game_players(match_id,game_number,team_id,player_id,player_type,player_name,equipment_snapshot)
  values(p_match_id,g,p_team_id,p_player_id,p_player_type,coalesce(nullif(p_player_name,''),p_player_id),snapshot);
  update public.kwl_games set
    status=case when exists(select 1 from public.kwl_game_players gp where gp.match_id=p_match_id and gp.game_number=g and gp.team_id<>p_team_id) then 'ready' else 'waiting' end,
    started_at=case when exists(select 1 from public.kwl_game_players gp where gp.match_id=p_match_id and gp.game_number=g and gp.team_id<>p_team_id) then coalesce(started_at,now()) else started_at end
  where match_id=p_match_id and game_number=g;
  update public.kwl_tournaments set status='live',updated_at=now() where tournament_key=m.tournament_key and status='drawn';
  update public.kwl_matches set status='live',updated_at=now() where id=p_match_id;
  insert into public.kwl_live_events(tournament_key,match_id,game_number,event_type,team_id,player_name,message,payload)
  values(m.tournament_key,p_match_id,g,'system',p_team_id,coalesce(nullif(p_player_name,''),p_player_id),coalesce(nullif(p_player_name,''),p_player_id)||' が第'||g||'試合に出場登録しました',jsonb_build_object('equipment_count',(select coalesce(sum(jsonb_array_length(value)),0) from jsonb_each(snapshot))));
  return jsonb_build_object('success',true,'game_number',g,'team_id',p_team_id,'equipment_snapshot',snapshot);
end $function$;
