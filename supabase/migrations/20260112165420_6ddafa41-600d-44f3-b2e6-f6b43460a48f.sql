-- Create table for caching campaign texts per book/platform/type
CREATE TABLE book_campaign_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'x', 'facebook', 'tiktok' etc.
  post_type TEXT NOT NULL, -- 'sales' or 'content'
  text TEXT NOT NULL,
  source_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, platform, post_type) -- one text per book/platform/type combination
);

-- Enable RLS
ALTER TABLE book_campaign_texts ENABLE ROW LEVEL SECURITY;

-- Public read access (for campaign generation)
CREATE POLICY "Public read access" ON book_campaign_texts FOR SELECT USING (true);

-- Allow inserts and updates for authenticated users
CREATE POLICY "Authenticated users can insert" ON book_campaign_texts 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update" ON book_campaign_texts 
  FOR UPDATE USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_book_campaign_texts_updated_at
BEFORE UPDATE ON book_campaign_texts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_book_campaign_texts_book_id ON book_campaign_texts(book_id);
CREATE INDEX idx_book_campaign_texts_platform ON book_campaign_texts(platform);