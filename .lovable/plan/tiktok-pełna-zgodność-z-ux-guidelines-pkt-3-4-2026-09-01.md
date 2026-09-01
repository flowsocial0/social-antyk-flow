# TikTok — pełna zgodność z UX Guidelines (pkt 3–4)

Odrzucenie dotyczy sekcji „Content Disclosure Setting". TikTok sprawdza nie tylko obecność pól, ale **dokładne zachowanie i dokładne teksty** (po angielsku, słowo w słowo) oraz to, że wszystkie interakcje widać na nagraniu demo.

## Co jest już OK

- Wybór prywatności bez wartości domyślnej (użytkownik musi kliknąć).
- Przełączniki Komentarze / Duet / Stitch z blokadą wg `creator_info`.
- Przełącznik ujawnienia treści z dwiema opcjami i blokada przycisku publikacji przy błędach.

## Czego brakuje (i to jest powód odrzucenia)

1. **„Tylko ja" musi być zablokowane**, gdy włączona jest Treść markowa — obecnie jest tylko komunikat błędu. TikTok wymaga wyszarzenia opcji + komunikatu „Branded content visibility cannot be set to private".
2. **Brak wymaganego tekstu zgody w dokładnym brzmieniu TikToka.** Musi być widoczny zawsze (nie tylko po zaznaczeniu opcji) i zmieniać treść:
   - bez ujawnienia: „By posting, you agree to TikTok's Music Usage Confirmation."
   - tylko własna marka: to samo.
   - treść markowa: „By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."
3. **Brak etykiety podsumowującej w wymaganym brzmieniu**: „Your video will be labeled 'Promotional content'" / „'Paid partnership'" / „'Paid partnership' and 'Promotional content'".
4. **Brak natychmiastowej informacji zwrotnej (toast)** przy włączeniu Treści markowej — TikTok wymaga widocznej reakcji UI, którą da się pokazać na wideo.
5. **Brak podsumowania przed publikacją** — recenzent musi zobaczyć finalny stan ustawień tuż przed kliknięciem „Publikuj".

## Zmiany w aplikacji

Wszystko w `src/components/campaigns/TikTokPublishOptions.tsx` (bez zmian w backendzie — wysyłane pola API pozostają te same):

- Poziom prywatności: opcja „Tylko ja" (`SELF_ONLY`) staje się **wyłączona i wyszarzona**, gdy `brandedContent = true`, z podpisem „Branded content visibility cannot be set to private". Jeśli była zaznaczona, wybór zostaje automatycznie wyczyszczony.
- Sekcja ujawnienia treści zyskuje stały opis: „Turn on to disclose that this video promotes goods or services in exchange for something of value."
- Dodanie stałego bloku zgody (zawsze widoczny, z linkami do Music Usage Confirmation i — dla treści markowej — Branded Content Policy), w oryginalnym angielskim brzmieniu wymaganym przez TikTok, z polskim tłumaczeniem pod spodem.
- Dodanie bloku etykiety w brzmieniu TikToka („Your video will be labeled …"), pokazywanego natychmiast po zaznaczeniu opcji.
- Toast przy włączeniu Treści markowej informujący o zablokowaniu opcji prywatnej.
- Krótkie podsumowanie na dole karty: konto, prywatność, interakcje, ujawnienie treści, etykieta — czytelne na nagraniu.
- Walidacja bez zmian merytorycznych: brak wyboru prywatności lub włączone ujawnienie bez wybranej opcji nadal blokuje publikację.

## Scenariusz nagrania demo (to jest połowa sukcesu)

Nagranie ~2–3 min, ekran + kursor, bez lektora, ale z widocznym wolnym klikaniem i zatrzymaniem 2–3 s na każdym elemencie:

1. Logowanie do aplikacji i przejście do kreatora kampanii.
2. Wybór wideo i konta TikTok — pokazać nazwę konta pobraną z `creator_info`.
3. Zatrzymać się na sekcji prywatności: pokazać, że **nic nie jest wybrane**, kliknąć kolejno każdą opcję.
4. Przełączyć Komentarze / Duet / Stitch w obie strony; pokazać opcję wyszarzoną, jeśli konto ma ją wyłączoną.
5. **Content Disclosure — najważniejsza część:** włączyć przełącznik, pokazać komunikat o wymaganym wyborze, zaznaczyć „Twoja marka" → pokazać etykietę „Promotional content"; odznaczyć; zaznaczyć „Treść markowa" → pokazać toast, wyszarzoną opcję „Tylko ja" i etykietę „Paid partnership"; zaznaczyć obie → pokazać etykietę łączoną.
6. Pokazać tekst zgody z linkami i kliknąć jeden link, żeby otworzył politykę TikToka.
7. Wyłączyć ujawnienie → pokazać, że etykiety znikają.
8. Ustawić finalne wartości, pokazać podsumowanie i kliknąć „Publikuj".
9. Pokazać opublikowany film w aplikacji TikTok wraz z etykietą.

## Uwagi techniczne

- Zmiany są wyłącznie frontendowe; `publish-to-tiktok` nadal otrzymuje `privacy_level`, `disable_comment`, `disable_duet`, `disable_stitch`, `brand_organic_toggle`, `brand_content_toggle`.
- Teksty wymagane przez TikTok pozostają po angielsku (recenzent czyta je dosłownie), z polskim wyjaśnieniem obok dla użytkowników.
