-- Create table for temporary storage of Facebook page selections during OAuth
CREATE TABLE public.facebook_page_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pages_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes')
);

-- Enable RLS
ALTER TABLE public.facebook_page_selections ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own selections
CREATE POLICY "Users can read own page selections" 
ON public.facebook_page_selections 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy for service role to insert (edge function uses service role)
CREATE POLICY "Service role can insert page selections" 
ON public.facebook_page_selections 
FOR INSERT 
WITH CHECK (true);

-- Policy for cleanup - allow deleting expired entries
CREATE POLICY "Anyone can delete expired selections" 
ON public.facebook_page_selections 
FOR DELETE 
USING (expires_at < NOW());