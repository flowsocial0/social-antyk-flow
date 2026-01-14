-- Drop existing check constraint and add new one with 'paused' and 'rate_limited' statuses
ALTER TABLE public.campaign_posts DROP CONSTRAINT IF EXISTS campaign_posts_status_check;

ALTER TABLE public.campaign_posts ADD CONSTRAINT campaign_posts_status_check 
CHECK (status IN ('scheduled', 'published', 'failed', 'paused', 'rate_limited'));