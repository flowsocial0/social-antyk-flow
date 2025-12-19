-- Add video_url column to books table
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add video_storage_path for uploaded videos
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS video_storage_path TEXT;