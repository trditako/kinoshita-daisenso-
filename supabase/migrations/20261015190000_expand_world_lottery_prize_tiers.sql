alter table public.world_lottery_tickets
  drop constraint if exists world_lottery_tickets_prize_tier_check;

alter table public.world_lottery_tickets
  add constraint world_lottery_tickets_prize_tier_check
  check (prize_tier in ('1', '2', '3', '4', '5', '6', '7'));

alter table public.world_lottery_draws
  alter column winner_counts set default '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0}'::jsonb;
