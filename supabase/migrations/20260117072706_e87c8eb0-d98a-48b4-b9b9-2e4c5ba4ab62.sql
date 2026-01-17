-- Przypisanie wszystkich istniejących danych do użytkownika antyk@ksiegarnia.pl
UPDATE public.books SET user_id = '662824bf-77c0-4a1d-9113-2d2338bebb42' WHERE user_id IS NULL;
UPDATE public.campaigns SET user_id = '662824bf-77c0-4a1d-9113-2d2338bebb42' WHERE user_id IS NULL;
UPDATE public.book_platform_content SET user_id = '662824bf-77c0-4a1d-9113-2d2338bebb42' WHERE user_id IS NULL;
UPDATE public.campaign_content_history SET user_id = '662824bf-77c0-4a1d-9113-2d2338bebb42' WHERE user_id IS NULL;
UPDATE public.book_campaign_texts SET user_id = '662824bf-77c0-4a1d-9113-2d2338bebb42' WHERE user_id IS NULL;
UPDATE public.xml_books SET user_id = '662824bf-77c0-4a1d-9113-2d2338bebb42' WHERE user_id IS NULL;

-- Ustawienie user_id jako NOT NULL
ALTER TABLE public.books ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.campaigns ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.book_platform_content ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.campaign_content_history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.book_campaign_texts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.xml_books ALTER COLUMN user_id SET NOT NULL;