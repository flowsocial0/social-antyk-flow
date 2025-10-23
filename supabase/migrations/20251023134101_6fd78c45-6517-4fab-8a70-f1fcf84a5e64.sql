-- Add template_type column to books table
ALTER TABLE books ADD COLUMN template_type text DEFAULT 'text' CHECK (template_type IN ('text', 'visual'));