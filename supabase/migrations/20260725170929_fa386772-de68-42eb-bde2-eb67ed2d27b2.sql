CREATE TABLE public.video_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  source_type text NOT NULL CHECK (source_type IN ('supabase_upload','mega_link')),
  storage_path text,
  public_url text,
  mega_url text,
  thumbnail_path text,
  thumbnail_url text,
  file_size_mb numeric,
  duration_sec integer,
  mime_type text,
  width integer,
  height integer,
  tags text[] NOT NULL DEFAULT '{}',
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_library_source_consistency CHECK (
    (source_type = 'supabase_upload' AND storage_path IS NOT NULL AND public_url IS NOT NULL)
    OR (source_type = 'mega_link' AND mega_url IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_library TO authenticated;
GRANT ALL ON public.video_library TO service_role;

ALTER TABLE public.video_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own videos select" ON public.video_library
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own videos insert" ON public.video_library
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own videos update" ON public.video_library
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own videos delete" ON public.video_library
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER video_library_updated_at
  BEFORE UPDATE ON public.video_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_video_library_user ON public.video_library(user_id, created_at DESC);
CREATE INDEX idx_video_library_tags ON public.video_library USING GIN(tags);