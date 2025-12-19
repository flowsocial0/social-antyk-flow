-- Create RLS policies for the ObrazkiKsiazek bucket to allow uploads

-- Policy to allow anyone to upload files (INSERT)
CREATE POLICY "Allow public uploads to ObrazkiKsiazek"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'ObrazkiKsiazek');

-- Policy to allow anyone to update files (UPDATE)
CREATE POLICY "Allow public updates to ObrazkiKsiazek"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'ObrazkiKsiazek');

-- Policy to allow anyone to delete files (DELETE)
CREATE POLICY "Allow public deletes to ObrazkiKsiazek"
ON storage.objects
FOR DELETE
USING (bucket_id = 'ObrazkiKsiazek');

-- Policy to allow anyone to read files (SELECT) - bucket is already public but this ensures RLS passes
CREATE POLICY "Allow public reads from ObrazkiKsiazek"
ON storage.objects
FOR SELECT
USING (bucket_id = 'ObrazkiKsiazek');