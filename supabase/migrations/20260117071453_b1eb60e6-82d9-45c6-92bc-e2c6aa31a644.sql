-- Fix remaining permissive policies

-- 1. book_campaign_texts - remove old policies (these weren't dropped due to different names)
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.book_campaign_texts;
DROP POLICY IF EXISTS "Authenticated users can update" ON public.book_campaign_texts;

-- 2. facebook_page_selections - this is OK, it's for service role from edge functions
-- We'll leave it as is since edge functions need to insert page selections

-- 3. xml_books - update policies to use user_id
-- First, add user_id column if not exists
ALTER TABLE public.xml_books ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can delete xml_books" ON public.xml_books;
DROP POLICY IF EXISTS "Anyone can insert xml_books" ON public.xml_books;
DROP POLICY IF EXISTS "Anyone can update xml_books" ON public.xml_books;
DROP POLICY IF EXISTS "Anyone can view xml_books" ON public.xml_books;

-- Create new user-scoped policies
CREATE POLICY "Users can view own xml_books" ON public.xml_books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own xml_books" ON public.xml_books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own xml_books" ON public.xml_books FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own xml_books" ON public.xml_books FOR DELETE USING (auth.uid() = user_id);