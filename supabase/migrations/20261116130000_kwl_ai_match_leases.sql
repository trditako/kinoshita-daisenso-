-- Serialize AI-worker processing for each KWL match and allow safe recovery after worker crashes.
-- This migration depends on the KWL BO5 tables from 20261114010000.

create table if not exists public.kwl_ai_match_locks (
  match_id bigint primary key references public.kwl_matches(id) on delete cascade,
  worker_id text not null,
  lease_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.kwl_ai_match_locks enable row level security;

create or replace function public.kwl_try_claim_ai_match(
  p_match_id bigint,
  p_worker_id text,
  p_lease_seconds integer default 180
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare claimed integer;
begin
  if coalesce(trim(p_worker_id),'')='' then
    raise exception 'worker_id is required';
  end if;
  insert into public.kwl_ai_match_locks(match_id,worker_id,lease_until,updated_at)
  values(p_match_id,p_worker_id,now()+make_interval(secs=>greatest(30,least(300,coalesce(p_lease_seconds,180)))),now())
  on conflict(match_id) do update
    set worker_id=excluded.worker_id,lease_until=excluded.lease_until,updated_at=now()
    where public.kwl_ai_match_locks.lease_until<=now()
       or public.kwl_ai_match_locks.worker_id=excluded.worker_id;
  get diagnostics claimed = row_count;
  return jsonb_build_object('claimed',claimed=1);
end
$$;

create or replace function public.kwl_release_ai_match(
  p_match_id bigint,
  p_worker_id text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare released integer;
begin
  delete from public.kwl_ai_match_locks
  where match_id=p_match_id and worker_id=p_worker_id;
  get diagnostics released = row_count;
  return jsonb_build_object('released',released=1);
end
$$;

revoke all on function public.kwl_try_claim_ai_match(bigint,text,integer) from public,anon,authenticated;
revoke all on function public.kwl_release_ai_match(bigint,text) from public,anon,authenticated;
grant execute on function public.kwl_try_claim_ai_match(bigint,text,integer) to service_role;
grant execute on function public.kwl_release_ai_match(bigint,text) to service_role;
