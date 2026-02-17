
-- FIX 1: ObrazkiKsiazek - Restrict write operations to authenticated users
DROP POLICY IF EXISTS "Allow public uploads to ObrazkiKsiazek" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to ObrazkiKsiazek" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes to ObrazkiKsiazek" ON storage.objects;

CREATE POLICY "Authenticated users can upload to ObrazkiKsiazek"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ObrazkiKsiazek' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update own files in ObrazkiKsiazek"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ObrazkiKsiazek' AND
    (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Users can delete own files in ObrazkiKsiazek"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ObrazkiKsiazek' AND
    (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'))
  );

-- FIX 2: bug-reports bucket - Make private and restrict access
UPDATE storage.buckets SET public = false WHERE id = 'bug-reports';

-- Drop overly permissive policy if exists
DROP POLICY IF EXISTS "Anyone can view bug report files" ON storage.objects;

-- Create proper policies for bug-reports bucket
CREATE POLICY "Users can view own bug report files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bug-reports' AND
    (
      EXISTS (
        SELECT 1 FROM bug_reports br
        WHERE br.user_id = auth.uid()
        AND br.screenshot_url LIKE '%' || name || '%'
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );
