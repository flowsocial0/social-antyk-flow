-- Add ai_text_youtube column for YouTube-specific descriptions
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS ai_text_youtube TEXT;

-- Add youtube_video_id to book_platform_content for tracking published videos
ALTER TABLE public.book_platform_content ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;