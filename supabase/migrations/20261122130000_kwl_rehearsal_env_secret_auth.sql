-- The rehearsal operator credential is managed as an Edge Function secret, not in the database.
drop table if exists public.kwl_rehearsal_credentials;
