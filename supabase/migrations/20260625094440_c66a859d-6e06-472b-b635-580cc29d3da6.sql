
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS tiktok_privacy_level text,
  ADD COLUMN IF NOT EXISTS tiktok_allow_comment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tiktok_allow_duet boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tiktok_allow_stitch boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tiktok_disclose_content boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_brand_organic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_branded_content boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_account_id uuid;

ALTER TABLE public.campaign_posts
  ADD COLUMN IF NOT EXISTS tiktok_privacy_level text,
  ADD COLUMN IF NOT EXISTS tiktok_allow_comment boolean,
  ADD COLUMN IF NOT EXISTS tiktok_allow_duet boolean,
  ADD COLUMN IF NOT EXISTS tiktok_allow_stitch boolean,
  ADD COLUMN IF NOT EXISTS tiktok_disclose_content boolean,
  ADD COLUMN IF NOT EXISTS tiktok_brand_organic boolean,
  ADD COLUMN IF NOT EXISTS tiktok_branded_content boolean,
  ADD COLUMN IF NOT EXISTS tiktok_account_id uuid;
