-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'cancelled')),
  duration_days INTEGER NOT NULL,
  posts_per_day INTEGER NOT NULL,
  content_posts_count INTEGER NOT NULL,
  sales_posts_count INTEGER NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  posting_times JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign_posts table
CREATE TABLE public.campaign_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  time TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('content', 'sales')),
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'published', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Anyone can view campaigns"
  ON public.campaigns FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update campaigns"
  ON public.campaigns FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete campaigns"
  ON public.campaigns FOR DELETE
  USING (true);

-- RLS Policies for campaign_posts
CREATE POLICY "Anyone can view campaign_posts"
  ON public.campaign_posts FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert campaign_posts"
  ON public.campaign_posts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update campaign_posts"
  ON public.campaign_posts FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete campaign_posts"
  ON public.campaign_posts FOR DELETE
  USING (true);

-- Create trigger for campaigns updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_campaign_posts_campaign_id ON public.campaign_posts(campaign_id);
CREATE INDEX idx_campaign_posts_scheduled_at ON public.campaign_posts(scheduled_at);
CREATE INDEX idx_campaign_posts_status ON public.campaign_posts(status);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);