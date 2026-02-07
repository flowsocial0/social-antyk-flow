
-- Discord tokens (webhook-based, like Telegram)
CREATE TABLE public.discord_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  webhook_url TEXT NOT NULL,
  channel_name TEXT,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.discord_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own discord tokens" ON public.discord_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own discord tokens" ON public.discord_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own discord tokens" ON public.discord_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own discord tokens" ON public.discord_tokens FOR DELETE USING (auth.uid() = user_id);

-- Tumblr OAuth tokens
CREATE TABLE public.tumblr_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  blog_name TEXT,
  username TEXT,
  account_name TEXT,
  scope TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tumblr_oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tumblr tokens" ON public.tumblr_oauth_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tumblr tokens" ON public.tumblr_oauth_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tumblr tokens" ON public.tumblr_oauth_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tumblr tokens" ON public.tumblr_oauth_tokens FOR DELETE USING (auth.uid() = user_id);

-- Snapchat OAuth tokens
CREATE TABLE public.snapchat_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  display_name TEXT,
  organization_id TEXT,
  account_name TEXT,
  scope TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.snapchat_oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own snapchat tokens" ON public.snapchat_oauth_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapchat tokens" ON public.snapchat_oauth_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapchat tokens" ON public.snapchat_oauth_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own snapchat tokens" ON public.snapchat_oauth_tokens FOR DELETE USING (auth.uid() = user_id);

-- Google Business tokens
CREATE TABLE public.google_business_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  account_id TEXT,
  location_id TEXT,
  business_name TEXT,
  account_name TEXT,
  scope TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.google_business_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own google business tokens" ON public.google_business_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own google business tokens" ON public.google_business_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own google business tokens" ON public.google_business_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own google business tokens" ON public.google_business_tokens FOR DELETE USING (auth.uid() = user_id);
