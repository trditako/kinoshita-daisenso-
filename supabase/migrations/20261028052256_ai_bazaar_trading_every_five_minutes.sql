-- Keep the public AI market cadence separate from normal AI simulation.
-- The existing ai-worker cron remains on its current 30-minute schedule.
do $$
begin
  if not exists (select 1 from cron.job where jobname='ai-bazaar-trading-5min') then
    perform cron.schedule(
      'ai-bazaar-trading-5min',
      '*/5 * * * *',
      $cmd$select net.http_post(
        url := 'https://jhohdvuoyvbzwjumnibc.supabase.co/functions/v1/ai-cron',
        body := '{"mode":"trading"}'::jsonb,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 10000
      );$cmd$
    );
  end if;
end $$;
