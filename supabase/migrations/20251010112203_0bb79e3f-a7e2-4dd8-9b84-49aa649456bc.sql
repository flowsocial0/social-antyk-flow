-- Create table for storing OAuth tokens
CREATE TABLE IF NOT EXISTS public.twitter_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.twitter_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (since we're not using user auth)
CREATE POLICY "Allow all operations on twitter_oauth_tokens"
  ON public.twitter_oauth_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_twitter_oauth_tokens_updated_at
  BEFORE UPDATE ON public.twitter_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();