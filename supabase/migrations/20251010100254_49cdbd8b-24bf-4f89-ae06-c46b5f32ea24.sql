-- Add published column to books table
ALTER TABLE public.books 
ADD COLUMN published boolean NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX idx_books_published ON public.books(published);