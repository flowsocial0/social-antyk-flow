-- Add unique constraint on user_id column for tiktok_oauth_tokens table
-- This is required for the upsert operation in the OAuth callback

ALTER TABLE public.tiktok_oauth_tokens 
ADD CONSTRAINT tiktok_oauth_tokens_user_id_key UNIQUE (user_id);