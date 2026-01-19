-- Add ai_text_linkedin column to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS ai_text_linkedin TEXT;