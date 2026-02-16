DROP TABLE IF EXISTS public.threads_oauth_tokens;

-- Update book_platform_content check constraint to remove 'threads'
ALTER TABLE public.book_platform_content DROP CONSTRAINT IF EXISTS book_platform_content_platform_check;
ALTER TABLE public.book_platform_content ADD CONSTRAINT book_platform_content_platform_check 
CHECK (platform = ANY (ARRAY['x', 'facebook', 'instagram', 'youtube', 'linkedin', 'tiktok', 'pinterest', 'telegram', 'bluesky', 'mastodon', 'gab', 'discord', 'tumblr', 'google-business']));