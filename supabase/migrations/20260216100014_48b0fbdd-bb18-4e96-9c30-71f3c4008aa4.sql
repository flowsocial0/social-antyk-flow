ALTER TABLE public.book_platform_content DROP CONSTRAINT book_platform_content_platform_check;

ALTER TABLE public.book_platform_content ADD CONSTRAINT book_platform_content_platform_check 
CHECK (platform = ANY (ARRAY['x'::text, 'facebook'::text, 'instagram'::text, 'youtube'::text, 'linkedin'::text, 'tiktok'::text, 'pinterest'::text, 'reddit'::text, 'telegram'::text, 'threads'::text, 'bluesky'::text, 'mastodon'::text, 'gab'::text, 'discord'::text, 'tumblr'::text, 'snapchat'::text, 'google-business'::text]));