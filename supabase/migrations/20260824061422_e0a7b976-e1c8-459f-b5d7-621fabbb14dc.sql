ALTER TABLE public.campaign_posts ADD COLUMN IF NOT EXISTS custom_video_url text;

CREATE INDEX IF NOT EXISTS idx_campaign_posts_queue
  ON public.campaign_posts (scheduled_at)
  WHERE status IN ('scheduled', 'rate_limited', 'failed');

CREATE INDEX IF NOT EXISTS idx_platform_publications_user_platform_time
  ON public.platform_publications (user_id, platform, published_at DESC);