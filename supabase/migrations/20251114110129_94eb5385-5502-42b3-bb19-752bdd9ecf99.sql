-- Create book_platform_content table
CREATE TABLE public.book_platform_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('x', 'facebook', 'instagram', 'youtube', 'linkedin', 'tiktok', 'pinterest', 'reddit', 'telegram', 'threads', 'bsky', 'mastodon')),
  
  -- Content specific to platform
  ai_generated_text text,
  custom_text text,
  
  -- Publishing status
  published boolean DEFAULT false,
  published_at timestamp with time zone,
  post_id text,
  
  -- Scheduling
  auto_publish_enabled boolean DEFAULT false,
  scheduled_publish_at timestamp with time zone,
  
  -- Platform-specific metadata
  hashtags text[],
  mentions text[],
  media_urls text[],
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  UNIQUE(book_id, platform)
);

-- Create indexes for better performance
CREATE INDEX idx_book_platform_content_book_id ON public.book_platform_content(book_id);
CREATE INDEX idx_book_platform_content_platform ON public.book_platform_content(platform);
CREATE INDEX idx_book_platform_content_scheduled ON public.book_platform_content(scheduled_publish_at) 
  WHERE auto_publish_enabled = true AND published = false;

-- Enable RLS
ALTER TABLE public.book_platform_content ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view book_platform_content"
  ON public.book_platform_content
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert book_platform_content"
  ON public.book_platform_content
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update book_platform_content"
  ON public.book_platform_content
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete book_platform_content"
  ON public.book_platform_content
  FOR DELETE
  USING (true);

-- Migrate existing data from books table to book_platform_content for platform 'x'
INSERT INTO public.book_platform_content (
  book_id,
  platform,
  ai_generated_text,
  published,
  auto_publish_enabled,
  scheduled_publish_at,
  created_at,
  updated_at
)
SELECT 
  id,
  'x',
  ai_generated_text,
  published,
  auto_publish_enabled,
  scheduled_publish_at,
  created_at,
  updated_at
FROM public.books
WHERE ai_generated_text IS NOT NULL OR published = true OR auto_publish_enabled = true;

-- Add trigger for updated_at
CREATE TRIGGER update_book_platform_content_updated_at
  BEFORE UPDATE ON public.book_platform_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();