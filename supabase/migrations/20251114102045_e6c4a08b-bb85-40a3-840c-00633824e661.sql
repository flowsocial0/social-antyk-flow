-- Add platforms column to campaign_posts table
ALTER TABLE campaign_posts 
ADD COLUMN platforms jsonb DEFAULT '["x"]'::jsonb;

-- Add target_platforms column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN target_platforms jsonb DEFAULT '["x"]'::jsonb;

-- Create facebook_oauth_tokens table
CREATE TABLE public.facebook_oauth_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token text NOT NULL,
  token_type text NOT NULL DEFAULT 'Bearer',
  expires_at timestamp with time zone,
  page_id text,
  page_name text,
  scope text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on facebook_oauth_tokens
ALTER TABLE public.facebook_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for facebook_oauth_tokens (allow all operations, similar to twitter_oauth_tokens)
CREATE POLICY "Allow all operations on facebook_oauth_tokens" 
ON public.facebook_oauth_tokens 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for facebook_oauth_tokens updated_at
CREATE TRIGGER update_facebook_oauth_tokens_updated_at
BEFORE UPDATE ON public.facebook_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data to default to X platform
UPDATE campaign_posts 
SET platforms = '["x"]'::jsonb 
WHERE platforms IS NULL;

UPDATE campaigns 
SET target_platforms = '["x"]'::jsonb 
WHERE target_platforms IS NULL;