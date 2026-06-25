Znalazłem konkretną przyczynę: w bazie ten post ma `custom_image_url` z poprawnym plikiem `.mp4`, ale `auto-publish-books` sprawdza wymóg TikToka za wcześnie — patrzy tylko na wideo z książki (`book.video_url` / `book.video_storage_path`), a ignoruje wideo dodane bezpośrednio do posta (`campaign_posts.custom_image_url`). Dlatego UI pokazuje wideo, a automat zgłasza „brak wideo”.

Plan naprawy:

1. Poprawić logikę w `auto-publish-books`
   - Rozpoznać wideo dodane do posta w `custom_image_url` przed walidacją TikToka.
   - Dla TikToka traktować `custom_image_url` z rozszerzeniem/ścieżką wideo jako prawidłowe źródło wideo.
   - Dopiero jeśli nie ma ani wideo posta, ani wideo książki, oznaczać błąd „TikTok wymaga wideo”.

2. Ujednolicić detekcję wideo
   - Dodać helper `isVideoUrl(...)`, żeby działało dla URL-i z query stringiem i storage URL, nie tylko prostego `.mp4` na końcu.
   - Użyć tej samej detekcji w walidacji i przy wywołaniu `publish-to-tiktok`.

3. Usprawnić komunikat błędu
   - Jeśli post ma załączony plik, ale nie wygląda jak wideo, komunikat będzie wskazywał na nieprawidłowy typ/URL zamiast mylącego „brak wideo”.

4. Naprawić dane istniejącego posta
   - Po zmianie zresetować widoczny na screenie post `4dac1bef-57f0-4f3c-adb5-f072b3978100` z `failed` na `scheduled`, wyczyścić błąd i ustawić najbliższą próbę publikacji.
   - Nie ruszać innych kampanii poza postami dotkniętymi tym konkretnym błędem.

5. Weryfikacja
   - Sprawdzić logi `auto-publish-books` / `publish-to-tiktok` po poprawce.
   - Potwierdzić w bazie, że post przestał mieć błąd „brak wideo” i przeszedł do próby publikacji lub kolejnego realnego statusu z TikToka.