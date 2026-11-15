-- Persist the equipment loadout selected when each KWL player is registered.
-- This migration depends on 20261114010000_kwl_bo5_series_and_broadcast.sql.
alter table public.kwl_game_players
  add column if not exists equipment_snapshot jsonb not null default '{}'::jsonb;

drop function if exists public.kwl_claim_game_player(bigint,bigint,text,text,text);

create function public.kwl_claim_game_player(
  p_match_id bigint,
  p_team_id bigint,
  p_player_id text,
  p_player_type text default 'player',
  p_player_name text default '',
  p_equipment_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
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
  if p_player_type not in ('player','ai') or coalesce(trim(p_player_id),'')='' then
    raise exception '選手情報が不正です';
  end if;
  select * into m from public.kwl_matches where id=p_match_id for update;
  if not found or m.status not in ('ready','live') then
    raise exception 'この試合は出場受付中ではありません';
  end if;
  select * into tour from public.kwl_tournaments where tournament_key=m.tournament_key for update;
  if not found or now()<tour.starts_at or tour.status not in ('drawn','live') then
    raise exception '大会開始前、または受付停止中です';
  end if;
  if p_team_id not in (m.team1_id,m.team2_id) then
    raise exception 'このチームは試合に参加していません';
  end if;
  select * into t from public.kwl_teams where id=p_team_id;
  select exists(
    select 1 from jsonb_array_elements(t.roster) x
    where x.value->>'id'=p_player_id
      and coalesce(x.value->>'type','player')=p_player_type
  ) into member_ok;
  if not member_ok then raise exception '登録選手ではありません'; end if;

  -- Accept only known equipment IDs and at most six items per character.
  if jsonb_typeof(p_equipment_snapshot)='object' then
    for entry in select key,value from jsonb_each(p_equipment_snapshot) limit 250 loop
      if length(entry.key)<=128 and jsonb_typeof(entry.value)='array' then
        select coalesce(jsonb_agg(x.item),'[]'::jsonb) into clean_ids
        from (
          select distinct v as item
          from jsonb_array_elements_text(entry.value) as a(v)
          where v=any(allowed_ids)
          limit 6
        ) x;
        snapshot := snapshot || jsonb_build_object(entry.key,clean_ids);
      end if;
    end loop;
  end if;

  if exists(
    select 1 from public.kwl_game_players
    where match_id=p_match_id and team_id=p_team_id
      and player_type=p_player_type and player_id=p_player_id
  ) then
    raise exception 'この選手はこのBO5シリーズですでに出場しています';
  end if;
  select x.game_number into g
  from public.kwl_games x
  where x.match_id=p_match_id and x.game_number<=5
    and not exists(
      select 1 from public.kwl_game_players gp
      where gp.match_id=x.match_id and gp.game_number=x.game_number and gp.team_id=p_team_id
    )
  order by x.game_number limit 1;
  if g is null then
    select coalesce(max(game_number),0)+1 into g
    from public.kwl_games where match_id=p_match_id;
    if g>5 then raise exception 'BO5の全試合枠が終了しています'; end if;
    insert into public.kwl_games(tournament_key,match_id,game_number,status)
    values(m.tournament_key,p_match_id,g,'waiting')
    on conflict(match_id,game_number) do nothing;
  end if;
  insert into public.kwl_game_players(
    match_id,game_number,team_id,player_id,player_type,player_name,equipment_snapshot
  ) values(
    p_match_id,g,p_team_id,p_player_id,p_player_type,
    coalesce(nullif(p_player_name,''),p_player_id),snapshot
  );
  update public.kwl_games set
    status=case when exists(
      select 1 from public.kwl_game_players gp
      where gp.match_id=p_match_id and gp.game_number=g and gp.team_id<>p_team_id
    ) then 'ready' else 'waiting' end,
    started_at=case when exists(
      select 1 from public.kwl_game_players gp
      where gp.match_id=p_match_id and gp.game_number=g and gp.team_id<>p_team_id
    ) then coalesce(started_at,now()) else started_at end
  where match_id=p_match_id and game_number=g;
  update public.kwl_tournaments set status='live',updated_at=now()
  where tournament_key=m.tournament_key and status='drawn';
  update public.kwl_matches set status='live',updated_at=now() where id=p_match_id;
  insert into public.kwl_live_events(
    tournament_key,match_id,game_number,event_type,team_id,player_name,message,payload
  ) values(
    m.tournament_key,p_match_id,g,'system',p_team_id,
    coalesce(nullif(p_player_name,''),p_player_id),
    coalesce(nullif(p_player_name,''),p_player_id)||' が第'||g||'試合に出場登録しました',
    jsonb_build_object('equipment_count',(
      select coalesce(sum(jsonb_array_length(value)),0) from jsonb_each(snapshot)
    ))
  );
  return jsonb_build_object(
    'success',true,'game_number',g,'team_id',p_team_id,'equipment_snapshot',snapshot
  );
end $$;

revoke all on function public.kwl_claim_game_player(bigint,bigint,text,text,text,jsonb) from public;
grant execute on function public.kwl_claim_game_player(bigint,bigint,text,text,text,jsonb) to anon,authenticated;
