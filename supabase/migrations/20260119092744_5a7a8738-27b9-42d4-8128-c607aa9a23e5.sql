-- ================================================================
-- Platform Rate Limits & Publications Tracking System
-- ================================================================

-- Table: platform_rate_limits
-- Tracks API rate limits from all platforms (X, Facebook, Instagram, TikTok, YouTube)
CREATE TABLE public.platform_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('x', 'facebook', 'instagram', 'tiktok', 'youtube')),
  limit_type text NOT NULL CHECK (limit_type IN ('daily', 'monthly', 'hourly', 'per_request', 'quota')),
  limit_name text DEFAULT 'default',
  limit_max integer NOT NULL,
  used integer DEFAULT 0,
  remaining integer NOT NULL,
  reset_at timestamptz,
  last_api_check timestamptz,
  api_headers jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, platform, limit_type, limit_name)
);

-- Table: platform_publications
-- Universal publication tracking across all platforms
CREATE TABLE public.platform_publications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('x', 'facebook', 'instagram', 'tiktok', 'youtube')),
  published_at timestamptz NOT NULL DEFAULT now(),
  post_id text,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'campaign', 'instant', 'auto')),
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  campaign_post_id uuid REFERENCES public.campaign_posts(id) ON DELETE SET NULL,
  quota_cost integer DEFAULT 1,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_platform_rate_limits_user ON public.platform_rate_limits(user_id);
CREATE INDEX idx_platform_rate_limits_lookup ON public.platform_rate_limits(account_id, platform, limit_type);
CREATE INDEX idx_platform_publications_user ON public.platform_publications(user_id);
CREATE INDEX idx_platform_publications_lookup ON public.platform_publications(account_id, platform, published_at DESC);

-- Enable RLS
ALTER TABLE public.platform_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_publications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_rate_limits
CREATE POLICY "Users can view their own rate limits"
  ON public.platform_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rate limits"
  ON public.platform_rate_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rate limits"
  ON public.platform_rate_limits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rate limits"
  ON public.platform_rate_limits FOR DELETE
  USING (auth.uid() = user_id);

-- Admin access for platform_rate_limits
CREATE POLICY "Admins can view all rate limits"
  ON public.platform_rate_limits FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for platform_publications
CREATE POLICY "Users can view their own publications"
  ON public.platform_publications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own publications"
  ON public.platform_publications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own publications"
  ON public.platform_publications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own publications"
  ON public.platform_publications FOR DELETE
  USING (auth.uid() = user_id);

-- Admin access for platform_publications
CREATE POLICY "Admins can view all publications"
  ON public.platform_publications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for auto-update of updated_at
CREATE TRIGGER update_platform_rate_limits_updated_at
  BEFORE UPDATE ON public.platform_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Service role access (for edge functions)
CREATE POLICY "Service role can manage rate limits"
  ON public.platform_rate_limits FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage publications"
  ON public.platform_publications FOR ALL
  USING (auth.role() = 'service_role');