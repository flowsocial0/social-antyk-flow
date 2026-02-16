-- Add unique constraint on (user_id, server_url) so upsert works correctly
-- First remove any duplicates keeping only the latest one
DELETE FROM public.mastodon_tokens a
USING public.mastodon_tokens b
WHERE a.user_id = b.user_id 
  AND a.server_url = b.server_url 
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX mastodon_tokens_user_server_unique ON public.mastodon_tokens (user_id, server_url);