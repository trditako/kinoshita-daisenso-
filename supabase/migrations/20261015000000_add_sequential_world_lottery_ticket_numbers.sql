create table if not exists public.world_lottery_number_sequence (
  id boolean primary key default true check (id),
  next_number integer not null check (next_number >= 0 and next_number < 1000000)
);
insert into public.world_lottery_number_sequence (id, next_number)
values (true, 0)
on conflict (id) do nothing;

alter table public.world_lottery_number_sequence enable row level security;
revoke all on public.world_lottery_number_sequence from public, anon, authenticated;

create or replace function public.allocate_world_lottery_ticket_numbers(p_count integer)
returns table(ticket_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate integer;
  attempts integer;
  issued integer;
begin
  if p_count is null or p_count < 1 or p_count > 10000 then
    raise exception 'p_count must be between 1 and 10000';
  end if;

  select s.next_number into candidate
  from public.world_lottery_number_sequence s
  where s.id = true
  for update;

  if candidate is null then
    raise exception 'lottery sequence is not initialized';
  end if;

  for issued in 1..p_count loop
    attempts := 0;
    loop
      if not exists (
        select 1 from public.world_lottery_tickets t
        where t.ticket_number = lpad(candidate::text, 6, '0')
      ) and not exists (
        select 1 from public.world_event_stage_claims c
        where c.ticket_number = lpad(candidate::text, 6, '0')
      ) then
        ticket_number := lpad(candidate::text, 6, '0');
        return next;
        candidate := (candidate + 1) % 1000000;
        exit;
      end if;

      candidate := (candidate + 1) % 1000000;
      attempts := attempts + 1;
      if attempts >= 1000000 then
        raise exception 'no unique lottery numbers remain';
      end if;
    end loop;
  end loop;

  update public.world_lottery_number_sequence
  set next_number = candidate
  where id = true;
end;
$$;

revoke all on function public.allocate_world_lottery_ticket_numbers(integer) from public, anon, authenticated;
grant execute on function public.allocate_world_lottery_ticket_numbers(integer) to service_role;
