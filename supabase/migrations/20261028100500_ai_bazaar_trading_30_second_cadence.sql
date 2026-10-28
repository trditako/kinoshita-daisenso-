-- pg_cron uses five-field cron expressions (minute precision). Invoke the
-- trading controller once per minute; ai-cron starts a second bounded pass 30s later.
do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in ('ai-bazaar-trading-5min','ai-bazaar-trading-30sec-paired') loop
    perform cron.unschedule(j.jobid);
  end loop;
  perform cron.schedule(
    'ai-bazaar-trading-30sec-paired',
    '* * * * *',
    $cmd$select net.http_post(
      url := 'https://jhohdvuoyvbzwjumnibc.supabase.co/functions/v1/ai-cron',
      body := '{"mode":"trading"}'::jsonb,
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 90000
    );$cmd$
  );
end $$;
