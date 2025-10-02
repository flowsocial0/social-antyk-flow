-- SocialFlow Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Books table
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    isbn TEXT,
    cover_url TEXT,
    store_link TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Scheduled posts table
CREATE TABLE public.scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'x', 'instagram', 'linkedin')),
    scheduled_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
    post_content TEXT,
    hashtags TEXT[],
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    published_at TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Activity log table
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Platform connections table (stores API credentials securely)
CREATE TABLE public.platform_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'x', 'instagram', 'linkedin')),
    is_active BOOLEAN DEFAULT false,
    credentials JSONB, -- Store encrypted tokens
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, platform)
);

-- Enable Row Level Security
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for books
CREATE POLICY "Users can view their own books"
    ON public.books FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books"
    ON public.books FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books"
    ON public.books FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books"
    ON public.books FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for scheduled_posts
CREATE POLICY "Users can view their own scheduled posts"
    ON public.scheduled_posts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled posts"
    ON public.scheduled_posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled posts"
    ON public.scheduled_posts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled posts"
    ON public.scheduled_posts FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for activity_log
CREATE POLICY "Users can view their own activity"
    ON public.activity_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
    ON public.activity_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policies for platform_connections
CREATE POLICY "Users can view their own platform connections"
    ON public.platform_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own platform connections"
    ON public.platform_connections FOR ALL
    USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_books_user_id ON public.books(user_id);
CREATE INDEX idx_scheduled_posts_user_id ON public.scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_scheduled_time ON public.scheduled_posts(scheduled_time);
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
