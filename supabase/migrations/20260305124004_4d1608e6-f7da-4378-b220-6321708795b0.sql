-- Clear video_storage_path for books that have Mega.nz URLs (redundant copies)
UPDATE books 
SET video_storage_path = NULL 
WHERE video_storage_path IS NOT NULL 
  AND video_storage_path != '' 
  AND video_url LIKE 'https://mega.nz/%';
