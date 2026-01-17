-- Add selected_accounts column to campaigns table
-- Stores which accounts are selected for each platform
-- Structure: { "x": ["account-id-1", "account-id-2"], "facebook": ["account-id-3"] }
ALTER TABLE public.campaigns 
ADD COLUMN selected_accounts JSONB DEFAULT '{}';

-- Add target_accounts column to campaign_posts table
-- Stores which accounts this specific post should be published to
ALTER TABLE public.campaign_posts 
ADD COLUMN target_accounts JSONB DEFAULT '{}';