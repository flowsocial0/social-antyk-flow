-- Create books table
CREATE TABLE public.books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  image_url TEXT,
  sale_price DECIMAL(10, 2),
  promotional_price DECIMAL(10, 2),
  stock_status TEXT,
  warehouse_quantity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (books are public data)
CREATE POLICY "Anyone can view books" 
ON public.books 
FOR SELECT 
USING (true);

-- Create policy for authenticated users to insert books (for CSV import)
CREATE POLICY "Authenticated users can insert books" 
ON public.books 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create policy for authenticated users to update books
CREATE POLICY "Authenticated users can update books" 
ON public.books 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create policy for authenticated users to delete books
CREATE POLICY "Authenticated users can delete books" 
ON public.books 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create index for faster lookups by code
CREATE INDEX idx_books_code ON public.books(code);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_books_updated_at
BEFORE UPDATE ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();