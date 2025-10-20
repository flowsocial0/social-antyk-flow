-- Create table for XML books import
CREATE TABLE IF NOT EXISTS public.xml_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  product_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.xml_books ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view
CREATE POLICY "Anyone can view xml_books" 
ON public.xml_books 
FOR SELECT 
USING (true);

-- Create policy to allow anyone to insert
CREATE POLICY "Anyone can insert xml_books" 
ON public.xml_books 
FOR INSERT 
WITH CHECK (true);

-- Create policy to allow anyone to delete
CREATE POLICY "Anyone can delete xml_books" 
ON public.xml_books 
FOR DELETE 
USING (true);