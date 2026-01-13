-- Create instagram_oauth_tokens table
CREATE TABLE public.instagram_oauth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  instagram_account_id TEXT NOT NULL,
  instagram_username TEXT,
  facebook_page_id TEXT,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instagram_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own instagram tokens" 
ON public.instagram_oauth_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instagram tokens" 
ON public.instagram_oauth_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instagram tokens" 
ON public.instagram_oauth_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instagram tokens" 
ON public.instagram_oauth_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_instagram_oauth_tokens_updated_at
BEFORE UPDATE ON public.instagram_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();