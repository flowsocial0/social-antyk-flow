-- Reset wszystkich is_default na false dla wszystkich platform
UPDATE facebook_oauth_tokens SET is_default = false WHERE is_default = true;
UPDATE twitter_oauth1_tokens SET is_default = false WHERE is_default = true;
UPDATE instagram_oauth_tokens SET is_default = false WHERE is_default = true;
UPDATE youtube_oauth_tokens SET is_default = false WHERE is_default = true;
UPDATE tiktok_oauth_tokens SET is_default = false WHERE is_default = true;
UPDATE linkedin_oauth_tokens SET is_default = false WHERE is_default = true;