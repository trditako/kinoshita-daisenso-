alter table public.bazaar_history enable row level security;
revoke all on table public.bazaar_history from anon, authenticated;
grant all on table public.bazaar_history to service_role;
