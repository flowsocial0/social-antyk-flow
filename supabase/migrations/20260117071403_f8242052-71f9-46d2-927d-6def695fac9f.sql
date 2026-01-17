-- Phase 1: Add user_id to main tables and update RLS policies

-- 1. Add user_id columns to tables that don't have them
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.book_platform_content ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.campaign_content_history ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.book_campaign_texts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_books_user_id ON public.books(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_book_platform_content_user_id ON public.book_platform_content(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_content_history_user_id ON public.campaign_content_history(user_id);
CREATE INDEX IF NOT EXISTS idx_book_campaign_texts_user_id ON public.book_campaign_texts(user_id);

-- 3. Update RLS policies for books table
DROP POLICY IF EXISTS "Anyone can view books" ON public.books;
DROP POLICY IF EXISTS "Anyone can insert books" ON public.books;
DROP POLICY IF EXISTS "Anyone can update books" ON public.books;
DROP POLICY IF EXISTS "Anyone can delete books" ON public.books;
DROP POLICY IF EXISTS "Users can view own books" ON public.books;
DROP POLICY IF EXISTS "Users can insert own books" ON public.books;
DROP POLICY IF EXISTS "Users can update own books" ON public.books;
DROP POLICY IF EXISTS "Users can delete own books" ON public.books;

CREATE POLICY "Users can view own books" ON public.books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own books" ON public.books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own books" ON public.books FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own books" ON public.books FOR DELETE USING (auth.uid() = user_id);

-- 4. Update RLS policies for campaigns table
DROP POLICY IF EXISTS "Anyone can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Anyone can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Anyone can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Anyone can delete campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;

CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

-- 5. Update RLS policies for book_platform_content table
DROP POLICY IF EXISTS "Anyone can view book_platform_content" ON public.book_platform_content;
DROP POLICY IF EXISTS "Anyone can insert book_platform_content" ON public.book_platform_content;
DROP POLICY IF EXISTS "Anyone can update book_platform_content" ON public.book_platform_content;
DROP POLICY IF EXISTS "Anyone can delete book_platform_content" ON public.book_platform_content;
DROP POLICY IF EXISTS "Users can view own book_platform_content" ON public.book_platform_content;
DROP POLICY IF EXISTS "Users can insert own book_platform_content" ON public.book_platform_content;
DROP POLICY IF EXISTS "Users can update own book_platform_content" ON public.book_platform_content;
DROP POLICY IF EXISTS "Users can delete own book_platform_content" ON public.book_platform_content;

CREATE POLICY "Users can view own book_platform_content" ON public.book_platform_content FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own book_platform_content" ON public.book_platform_content FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own book_platform_content" ON public.book_platform_content FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own book_platform_content" ON public.book_platform_content FOR DELETE USING (auth.uid() = user_id);

-- 6. Update RLS policies for campaign_content_history table
DROP POLICY IF EXISTS "Anyone can view campaign_content_history" ON public.campaign_content_history;
DROP POLICY IF EXISTS "Anyone can insert campaign_content_history" ON public.campaign_content_history;
DROP POLICY IF EXISTS "Anyone can update campaign_content_history" ON public.campaign_content_history;
DROP POLICY IF EXISTS "Anyone can delete campaign_content_history" ON public.campaign_content_history;
DROP POLICY IF EXISTS "Users can view own campaign_content_history" ON public.campaign_content_history;
DROP POLICY IF EXISTS "Users can insert own campaign_content_history" ON public.campaign_content_history;
DROP POLICY IF EXISTS "Users can update own campaign_content_history" ON public.campaign_content_history;
DROP POLICY IF EXISTS "Users can delete own campaign_content_history" ON public.campaign_content_history;

CREATE POLICY "Users can view own campaign_content_history" ON public.campaign_content_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaign_content_history" ON public.campaign_content_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaign_content_history" ON public.campaign_content_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaign_content_history" ON public.campaign_content_history FOR DELETE USING (auth.uid() = user_id);

-- 7. Update RLS policies for book_campaign_texts table
DROP POLICY IF EXISTS "Anyone can view book_campaign_texts" ON public.book_campaign_texts;
DROP POLICY IF EXISTS "Anyone can insert book_campaign_texts" ON public.book_campaign_texts;
DROP POLICY IF EXISTS "Anyone can update book_campaign_texts" ON public.book_campaign_texts;
DROP POLICY IF EXISTS "Anyone can delete book_campaign_texts" ON public.book_campaign_texts;
DROP POLICY IF EXISTS "Users can view own book_campaign_texts" ON public.book_campaign_texts;
DROP POLICY IF EXISTS "Users can insert own book_campaign_texts" ON public.book_campaign_texts;
DROP POLICY IF EXISTS "Users can update own book_campaign_texts" ON public.book_campaign_texts;
DROP POLICY IF EXISTS "Users can delete own book_campaign_texts" ON public.book_campaign_texts;

CREATE POLICY "Users can view own book_campaign_texts" ON public.book_campaign_texts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own book_campaign_texts" ON public.book_campaign_texts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own book_campaign_texts" ON public.book_campaign_texts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own book_campaign_texts" ON public.book_campaign_texts FOR DELETE USING (auth.uid() = user_id);

-- 8. Update RLS for campaign_posts (inherit through campaign_id foreign key)
DROP POLICY IF EXISTS "Anyone can view campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Anyone can insert campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Anyone can update campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Anyone can delete campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Users can view own campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Users can insert own campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Users can update own campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Users can delete own campaign_posts" ON public.campaign_posts;

-- For campaign_posts, we check through the campaign's user_id
CREATE POLICY "Users can view own campaign_posts" ON public.campaign_posts 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_posts.campaign_id AND campaigns.user_id = auth.uid())
);

CREATE POLICY "Users can insert own campaign_posts" ON public.campaign_posts 
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_posts.campaign_id AND campaigns.user_id = auth.uid())
);

CREATE POLICY "Users can update own campaign_posts" ON public.campaign_posts 
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_posts.campaign_id AND campaigns.user_id = auth.uid())
);

CREATE POLICY "Users can delete own campaign_posts" ON public.campaign_posts 
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_posts.campaign_id AND campaigns.user_id = auth.uid())
);