-- Create table for LinkedIn OAuth tokens
CREATE TABLE public.linkedin_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  linkedin_id TEXT,
  display_name TEXT,
  profile_picture_url TEXT,
  scope TEXT,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.linkedin_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own LinkedIn tokens"
ON public.linkedin_oauth_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own LinkedIn tokens"
ON public.linkedin_oauth_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LinkedIn tokens"
ON public.linkedin_oauth_tokens
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own LinkedIn tokens"
ON public.linkedin_oauth_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_linkedin_oauth_tokens_updated_at
BEFORE UPDATE ON public.linkedin_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_linkedin_oauth_tokens_user_id ON public.linkedin_oauth_tokens(user_id);
CREATE INDEX idx_linkedin_oauth_tokens_linkedin_id ON public.linkedin_oauth_tokens(linkedin_id);