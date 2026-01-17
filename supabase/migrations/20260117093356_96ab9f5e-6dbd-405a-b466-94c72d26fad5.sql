-- FIX CRITICAL SECURITY ISSUE: Remove overly permissive RLS policies

-- 1. Remove the "Public read access" policy from book_campaign_texts
-- This policy allows anyone to read all data, which is a serious security issue
DROP POLICY IF EXISTS "Public read access" ON public.book_campaign_texts;

-- 2. Fix facebook_page_selections INSERT policy - should only allow service role
-- First drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can insert page selections" ON public.facebook_page_selections;

-- Recreate with proper check - only users can insert their own selections
-- (service role bypasses RLS anyway, so we use user_id check for regular users)
CREATE POLICY "Users can insert own page selections" 
ON public.facebook_page_selections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);