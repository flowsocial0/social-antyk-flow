
-- 1. Clean old cron job run details (keep last 7 days)
DELETE FROM cron.job_run_details WHERE start_time < NOW() - INTERVAL '7 days';

-- 2. Schedule daily cleanup of cron.job_run_details
SELECT cron.schedule(
  'cleanup-cron-job-details-daily',
  '30 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE start_time < NOW() - INTERVAL '7 days'$$
);

-- 3. Clean old HTTP response logs (keep last 24h)
DELETE FROM net._http_response WHERE created < NOW() - INTERVAL '1 day';

-- 4. Schedule daily cleanup of net._http_response
SELECT cron.schedule(
  'cleanup-http-response-daily',
  '0 4 * * *',
  $$DELETE FROM net._http_response WHERE created < NOW() - INTERVAL '1 day'$$
);
