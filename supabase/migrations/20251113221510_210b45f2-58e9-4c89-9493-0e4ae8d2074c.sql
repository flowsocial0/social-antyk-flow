-- Add campaign tracking fields to books table
ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS campaign_post_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_campaign_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_product boolean DEFAULT false;

-- Update existing records to mark products (books with product URLs)
UPDATE public.books
SET is_product = true
WHERE product_url IS NOT NULL AND product_url != '';

-- Create index for efficient querying of available products
CREATE INDEX IF NOT EXISTS idx_books_campaign_availability 
ON public.books(is_product, campaign_post_count, last_campaign_date)
WHERE is_product = true;