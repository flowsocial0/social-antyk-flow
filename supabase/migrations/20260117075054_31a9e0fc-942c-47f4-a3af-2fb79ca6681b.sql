-- Add unique constraint on x_user_id for twitter_oauth1_tokens
-- This allows multiple X accounts per user while preventing duplicate X accounts
ALTER TABLE public.twitter_oauth1_tokens
ADD CONSTRAINT twitter_oauth1_tokens_x_user_id_key UNIQUE (x_user_id);