
-- Add oauth_token_secret to tumblr_oauth_tokens for OAuth1
ALTER TABLE public.tumblr_oauth_tokens ADD COLUMN IF NOT EXISTS oauth_token_secret text;

-- Create temp request tokens table for OAuth1 flow
CREATE TABLE IF NOT EXISTS public.tumblr_oauth1_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  state text NOT NULL,
  oauth_token text NOT NULL,
  oauth_token_secret text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.tumblr_oauth1_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tumblr oauth1 requests"
  ON public.tumblr_oauth1_requests
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
