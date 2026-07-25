ALTER TABLE public.campaign_posts
  ADD COLUMN IF NOT EXISTS youtube_title text,
  ADD COLUMN IF NOT EXISTS youtube_description text,
  ADD COLUMN IF NOT EXISTS youtube_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS youtube_privacy_status text,
  ADD COLUMN IF NOT EXISTS youtube_tags text[];

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS youtube_title text,
  ADD COLUMN IF NOT EXISTS youtube_description text,
  ADD COLUMN IF NOT EXISTS youtube_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS youtube_privacy_status text,
  ADD COLUMN IF NOT EXISTS youtube_tags text[];