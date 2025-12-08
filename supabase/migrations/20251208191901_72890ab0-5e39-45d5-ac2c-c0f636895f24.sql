-- Add author column to books table
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS author text;

-- Add comment for clarity
COMMENT ON COLUMN public.books.author IS 'Book author name';