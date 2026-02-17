-- Fix xml_books table: restrict to service_role only (used by sync edge functions with SUPABASE_SERVICE_ROLE_KEY)
DROP POLICY IF EXISTS "Anyone can view xml_books" ON public.xml_books;
DROP POLICY IF EXISTS "Anyone can insert xml_books" ON public.xml_books;
DROP POLICY IF EXISTS "Anyone can delete xml_books" ON public.xml_books;

-- Only service role (edge functions) can access this table
CREATE POLICY "Service role can manage xml_books"
ON public.xml_books FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');