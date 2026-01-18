-- Fix book code uniqueness - drop constraint (not just index)
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_code_key;

-- Create new composite unique index for (user_id, code)
CREATE UNIQUE INDEX IF NOT EXISTS books_user_id_code_key ON public.books (user_id, code);