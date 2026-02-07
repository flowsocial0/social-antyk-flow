
-- ============================================
-- Token tables for 7 new social platforms
-- ============================================

-- 1. Threads OAuth tokens
CREATE TABLE public.threads_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  threads_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  username TEXT,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.threads_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own threads tokens" ON public.threads_oauth_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own threads tokens" ON public.threads_oauth_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own threads tokens" ON public.threads_oauth_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own threads tokens" ON public.threads_oauth_tokens FOR DELETE USING (auth.uid() = user_id);

-- 2. Bluesky tokens (App Password based, not OAuth)
CREATE TABLE public.bluesky_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  did TEXT,
  app_password TEXT NOT NULL,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bluesky_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bluesky tokens" ON public.bluesky_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bluesky tokens" ON public.bluesky_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bluesky tokens" ON public.bluesky_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bluesky tokens" ON public.bluesky_tokens FOR DELETE USING (auth.uid() = user_id);

-- 3. Telegram tokens (Bot Token based)
CREATE TABLE public.telegram_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_token TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  channel_name TEXT,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.telegram_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram tokens" ON public.telegram_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own telegram tokens" ON public.telegram_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own telegram tokens" ON public.telegram_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own telegram tokens" ON public.telegram_tokens FOR DELETE USING (auth.uid() = user_id);

-- 4. Pinterest OAuth tokens
CREATE TABLE public.pinterest_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  username TEXT,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pinterest_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pinterest tokens" ON public.pinterest_oauth_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pinterest tokens" ON public.pinterest_oauth_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pinterest tokens" ON public.pinterest_oauth_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pinterest tokens" ON public.pinterest_oauth_tokens FOR DELETE USING (auth.uid() = user_id);

-- 5. Reddit OAuth tokens
CREATE TABLE public.reddit_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  username TEXT,
  default_subreddit TEXT,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reddit_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reddit tokens" ON public.reddit_oauth_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reddit tokens" ON public.reddit_oauth_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reddit tokens" ON public.reddit_oauth_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reddit tokens" ON public.reddit_oauth_tokens FOR DELETE USING (auth.uid() = user_id);

-- 6. Mastodon tokens
CREATE TABLE public.mastodon_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_url TEXT NOT NULL,
  access_token TEXT NOT NULL,
  username TEXT,
  client_id TEXT,
  client_secret TEXT,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mastodon_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mastodon tokens" ON public.mastodon_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mastodon tokens" ON public.mastodon_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mastodon tokens" ON public.mastodon_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mastodon tokens" ON public.mastodon_tokens FOR DELETE USING (auth.uid() = user_id);

-- 7. Gab tokens
CREATE TABLE public.gab_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  username TEXT,
  client_id TEXT,
  client_secret TEXT,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gab_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gab tokens" ON public.gab_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gab tokens" ON public.gab_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gab tokens" ON public.gab_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gab tokens" ON public.gab_tokens FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at triggers for all new tables
CREATE TRIGGER update_threads_oauth_tokens_updated_at BEFORE UPDATE ON public.threads_oauth_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bluesky_tokens_updated_at BEFORE UPDATE ON public.bluesky_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_telegram_tokens_updated_at BEFORE UPDATE ON public.telegram_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pinterest_oauth_tokens_updated_at BEFORE UPDATE ON public.pinterest_oauth_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reddit_oauth_tokens_updated_at BEFORE UPDATE ON public.reddit_oauth_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mastodon_tokens_updated_at BEFORE UPDATE ON public.mastodon_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gab_tokens_updated_at BEFORE UPDATE ON public.gab_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
