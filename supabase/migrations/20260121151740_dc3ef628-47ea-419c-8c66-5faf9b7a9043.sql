-- Usunięcie constraintów UNIQUE blokujących wiele kont na user_id
-- Facebook
ALTER TABLE facebook_oauth_tokens DROP CONSTRAINT IF EXISTS facebook_oauth_tokens_user_id_unique;
ALTER TABLE facebook_oauth_tokens DROP CONSTRAINT IF EXISTS facebook_oauth_tokens_user_id_key;

-- Twitter OAuth2
ALTER TABLE twitter_oauth_tokens DROP CONSTRAINT IF EXISTS twitter_oauth_tokens_user_id_unique;
ALTER TABLE twitter_oauth_tokens DROP CONSTRAINT IF EXISTS twitter_oauth_tokens_user_id_key;

-- Instagram
ALTER TABLE instagram_oauth_tokens DROP CONSTRAINT IF EXISTS instagram_oauth_tokens_user_id_unique;
ALTER TABLE instagram_oauth_tokens DROP CONSTRAINT IF EXISTS instagram_oauth_tokens_user_id_key;

-- YouTube
ALTER TABLE youtube_oauth_tokens DROP CONSTRAINT IF EXISTS youtube_oauth_tokens_user_id_unique;
ALTER TABLE youtube_oauth_tokens DROP CONSTRAINT IF EXISTS youtube_oauth_tokens_user_id_key;

-- TikTok
ALTER TABLE tiktok_oauth_tokens DROP CONSTRAINT IF EXISTS tiktok_oauth_tokens_user_id_unique;
ALTER TABLE tiktok_oauth_tokens DROP CONSTRAINT IF EXISTS tiktok_oauth_tokens_user_id_key;

-- LinkedIn
ALTER TABLE linkedin_oauth_tokens DROP CONSTRAINT IF EXISTS linkedin_oauth_tokens_user_id_unique;
ALTER TABLE linkedin_oauth_tokens DROP CONSTRAINT IF EXISTS linkedin_oauth_tokens_user_id_key;