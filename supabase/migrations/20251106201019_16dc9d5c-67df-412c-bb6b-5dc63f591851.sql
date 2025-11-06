-- Add column for AI generated sales text
ALTER TABLE books 
ADD COLUMN ai_generated_text text;

-- Add index for better performance when filtering by ai_generated_text
CREATE INDEX idx_books_ai_generated_text ON books(ai_generated_text) WHERE ai_generated_text IS NOT NULL;