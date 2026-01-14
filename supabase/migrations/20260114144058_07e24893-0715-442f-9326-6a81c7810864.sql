-- Drop existing check constraint and add new one with 'paused' status
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_check 
CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'cancelled', 'paused'));