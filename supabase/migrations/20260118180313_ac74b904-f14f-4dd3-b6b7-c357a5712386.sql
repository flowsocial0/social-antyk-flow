-- Create table for tracking X (Twitter) API rate limits per account
CREATE TABLE public.x_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.twitter_oauth1_tokens(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- 'tweets', 'media_upload', etc.
  limit_max INTEGER,      -- x-rate-limit-limit header value
  remaining INTEGER,      -- x-rate-limit-remaining header value
  reset_at TIMESTAMPTZ,   -- from x-rate-limit-reset header (Unix timestamp converted)
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.x_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own rate limits (via twitter_oauth1_tokens ownership)
CREATE POLICY "Users can view their own rate limits"
ON public.x_rate_limits
FOR SELECT
USING (
  account_id IN (
    SELECT id FROM public.twitter_oauth1_tokens 
    WHERE user_id = auth.uid()
  )
);

-- Create policy for service role to manage all rate limits (for edge functions)
CREATE POLICY "Service role can manage all rate limits"
ON public.x_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_x_rate_limits_account_endpoint ON public.x_rate_limits(account_id, endpoint);
CREATE INDEX idx_x_rate_limits_reset_at ON public.x_rate_limits(reset_at);