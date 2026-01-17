-- Phase 2: Support multiple social accounts per platform

-- 1. Twitter OAuth1 tokens - remove unique constraint and add account_name
ALTER TABLE public.twitter_oauth1_tokens DROP CONSTRAINT IF EXISTS twitter_oauth1_tokens_user_id_key;
ALTER TABLE public.twitter_oauth1_tokens ADD COLUMN IF NOT EXISTS account_name text;
ALTER TABLE public.twitter_oauth1_tokens ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
-- Create new unique constraint on user_id + screen_name
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitter_oauth1_tokens_user_account_unique') THEN
    ALTER TABLE public.twitter_oauth1_tokens ADD CONSTRAINT twitter_oauth1_tokens_user_account_unique UNIQUE(user_id, screen_name);
  END IF;
END $$;

-- 2. Facebook OAuth tokens - remove unique constraint and add account_name
ALTER TABLE public.facebook_oauth_tokens DROP CONSTRAINT IF EXISTS facebook_oauth_tokens_user_id_key;
ALTER TABLE public.facebook_oauth_tokens ADD COLUMN IF NOT EXISTS account_name text;
ALTER TABLE public.facebook_oauth_tokens ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
-- Create new unique constraint on user_id + page_id
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facebook_oauth_tokens_user_page_unique') THEN
    ALTER TABLE public.facebook_oauth_tokens ADD CONSTRAINT facebook_oauth_tokens_user_page_unique UNIQUE(user_id, page_id);
  END IF;
END $$;

-- 3. Instagram OAuth tokens - remove unique constraint and add account_name
ALTER TABLE public.instagram_oauth_tokens DROP CONSTRAINT IF EXISTS instagram_oauth_tokens_user_id_key;
ALTER TABLE public.instagram_oauth_tokens ADD COLUMN IF NOT EXISTS account_name text;
ALTER TABLE public.instagram_oauth_tokens ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
-- Create new unique constraint on user_id + instagram_account_id
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instagram_oauth_tokens_user_account_unique') THEN
    ALTER TABLE public.instagram_oauth_tokens ADD CONSTRAINT instagram_oauth_tokens_user_account_unique UNIQUE(user_id, instagram_account_id);
  END IF;
END $$;

-- 4. TikTok OAuth tokens - remove unique constraint and add account_name
ALTER TABLE public.tiktok_oauth_tokens DROP CONSTRAINT IF EXISTS tiktok_oauth_tokens_user_id_key;
ALTER TABLE public.tiktok_oauth_tokens ADD COLUMN IF NOT EXISTS account_name text;
ALTER TABLE public.tiktok_oauth_tokens ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
-- Create new unique constraint on user_id + open_id
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tiktok_oauth_tokens_user_account_unique') THEN
    ALTER TABLE public.tiktok_oauth_tokens ADD CONSTRAINT tiktok_oauth_tokens_user_account_unique UNIQUE(user_id, open_id);
  END IF;
END $$;

-- 5. YouTube OAuth tokens - remove unique constraint and add account_name
ALTER TABLE public.youtube_oauth_tokens DROP CONSTRAINT IF EXISTS youtube_oauth_tokens_user_id_key;
ALTER TABLE public.youtube_oauth_tokens ADD COLUMN IF NOT EXISTS account_name text;
ALTER TABLE public.youtube_oauth_tokens ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
-- Create new unique constraint on user_id + channel_id
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'youtube_oauth_tokens_user_channel_unique') THEN
    ALTER TABLE public.youtube_oauth_tokens ADD CONSTRAINT youtube_oauth_tokens_user_channel_unique UNIQUE(user_id, channel_id);
  END IF;
END $$;

-- 6. Set existing accounts as default
UPDATE public.twitter_oauth1_tokens SET is_default = true WHERE is_default IS NULL OR is_default = false;
UPDATE public.facebook_oauth_tokens SET is_default = true WHERE is_default IS NULL OR is_default = false;
UPDATE public.instagram_oauth_tokens SET is_default = true WHERE is_default IS NULL OR is_default = false;
UPDATE public.tiktok_oauth_tokens SET is_default = true WHERE is_default IS NULL OR is_default = false;
UPDATE public.youtube_oauth_tokens SET is_default = true WHERE is_default IS NULL OR is_default = false;

-- 7. Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_twitter_oauth1_tokens_user_default ON public.twitter_oauth1_tokens(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_facebook_oauth_tokens_user_default ON public.facebook_oauth_tokens(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_instagram_oauth_tokens_user_default ON public.instagram_oauth_tokens(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_tiktok_oauth_tokens_user_default ON public.tiktok_oauth_tokens(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_youtube_oauth_tokens_user_default ON public.youtube_oauth_tokens(user_id, is_default);