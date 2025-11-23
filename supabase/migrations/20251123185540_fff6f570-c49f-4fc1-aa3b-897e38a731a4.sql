-- Create table for OAuth 1.0a tokens (user-specific)
CREATE TABLE public.twitter_oauth1_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  oauth_token TEXT NOT NULL,
  oauth_token_secret TEXT NOT NULL,
  screen_name TEXT,
  x_user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.twitter_oauth1_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own OAuth1 tokens"
  ON public.twitter_oauth1_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OAuth1 tokens"
  ON public.twitter_oauth1_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OAuth1 tokens"
  ON public.twitter_oauth1_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OAuth1 tokens"
  ON public.twitter_oauth1_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create temporary table for OAuth 1.0a request tokens
CREATE TABLE public.twitter_oauth1_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  state TEXT NOT NULL UNIQUE,
  oauth_token TEXT NOT NULL,
  oauth_token_secret TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '10 minutes')
);

-- Enable RLS
ALTER TABLE public.twitter_oauth1_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for requests table
CREATE POLICY "Users can view their own OAuth1 requests"
  ON public.twitter_oauth1_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OAuth1 requests"
  ON public.twitter_oauth1_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OAuth1 requests"
  ON public.twitter_oauth1_requests
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_twitter_oauth1_tokens_updated_at
  BEFORE UPDATE ON public.twitter_oauth1_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_twitter_oauth1_tokens_user_id ON public.twitter_oauth1_tokens(user_id);
CREATE INDEX idx_twitter_oauth1_requests_state ON public.twitter_oauth1_requests(state);
CREATE INDEX idx_twitter_oauth1_requests_expires_at ON public.twitter_oauth1_requests(expires_at);