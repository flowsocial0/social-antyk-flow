-- Add exclude_from_campaigns column to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS exclude_from_campaigns BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN books.exclude_from_campaigns IS 'When true, this book will be excluded from auto-publishing and campaign generation';