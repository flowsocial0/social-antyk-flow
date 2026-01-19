-- Create table to track daily X publications (independent of API rate limit headers)
CREATE TABLE IF NOT EXISTS public.x_daily_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.twitter_oauth1_tokens(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  tweet_id text,
  source text NOT NULL DEFAULT 'manual', -- 'book', 'campaign', 'instant', 'manual'
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  campaign_post_id uuid REFERENCES public.campaign_posts(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.x_daily_publications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own X publications"
ON public.x_daily_publications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own X publications"
ON public.x_daily_publications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role has full access to X publications"
ON public.x_daily_publications
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient queries on last 24h publications
CREATE INDEX idx_x_daily_publications_account_time ON public.x_daily_publications(account_id, published_at DESC);
CREATE INDEX idx_x_daily_publications_user_time ON public.x_daily_publications(user_id, published_at DESC);