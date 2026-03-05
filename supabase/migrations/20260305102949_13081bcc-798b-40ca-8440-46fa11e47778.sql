SELECT cron.schedule(
  'cleanup-temp-videos-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://dmrfbokchkxjzslfzeps.supabase.co/functions/v1/cleanup-temp-videos',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcmZib2tjaGt4anpzbGZ6ZXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTc4NTksImV4cCI6MjA3NDk3Mzg1OX0.c6FlbkKl16DCeKBiTBJgxGaB22Ege2RvssMMhlLEKlo"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);