-- Table to store campaign generation progress for batched generation
CREATE TABLE IF NOT EXISTS public.campaign_generation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total_posts INTEGER NOT NULL,
  generated_posts INTEGER DEFAULT 0,
  structure JSONB,
  posts JSONB DEFAULT '[]'::jsonb,
  config JSONB,
  status TEXT DEFAULT 'in_progress',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_generation_progress ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own progress
CREATE POLICY "Users can view own generation progress"
  ON public.campaign_generation_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generation progress"
  ON public.campaign_generation_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generation progress"
  ON public.campaign_generation_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generation progress"
  ON public.campaign_generation_progress
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_campaign_generation_progress_updated_at
  BEFORE UPDATE ON public.campaign_generation_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookup by user
CREATE INDEX idx_campaign_generation_progress_user_id ON public.campaign_generation_progress(user_id);

-- Auto-cleanup old records (older than 24 hours)
CREATE INDEX idx_campaign_generation_progress_created_at ON public.campaign_generation_progress(created_at);