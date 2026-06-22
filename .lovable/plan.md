## Diagnoza

Auto-publish kampanii nie jest martwy — Edge Function `auto-publish-books` uruchamia się, ale obecnie wpada w zator:

- funkcja jednorazowo pobiera aż `1000` zaległych postów kampanii,
- najstarsze zaległe posty są z maja 2026 i blokują świeższe kampanie,
- logi pokazują ciągłe próby publikacji tego samego posta na Facebooku i rate-limit od Meta,
- w jednym poście `target_accounts.facebook` ma ten sam UUID powtórzony 5 razy, więc funkcja publikuje ten sam post kilka razy na to samo konto w jednym cyklu,
- przez to kolejne kampanie wyglądają jakby „stały”, mimo że system cały czas mieli backlog.

Przykład z danych:

- aktywne/zaplanowane kampanie mają `1003` zaległe posty w statusie `scheduled`,
- kilka dużych kampanii ma po ok. `248-250` zaległych postów,
- aktualnie oglądana kampania ma 1 post zaległy od `2026-06-22 08:00 UTC`, ale znajduje się za starszym backlogiem.

## Plan naprawy

### 1. Ograniczyć jedną paczkę auto-publish

W `supabase/functions/auto-publish-books/index.ts` zmienić pobieranie postów kampanii tak, żeby nie brało naraz `1000+` rekordów bez kontroli.

Proponowana logika:

- pobieraj maksymalnie małą paczkę, np. `25` postów na cykl,
- sortuj po `scheduled_at asc`, ale nie pozwól jednemu ogromnemu backlogowi monopolizować całego cyklu,
- zachowaj obecny lock `status = publishing`, żeby nie wróciły duplikaty równoległych publikacji.

### 2. Deduplicacja kont przed publikacją

Przed pętlą po `accountsForPlatform` dodać deduplikację:

```ts
accountsForPlatform = [...new Set(accountsForPlatform.filter(Boolean))];
```

To zatrzyma przypadek z logów, gdzie Facebook dostaje ten sam account ID pięć razy w jednym poście.

### 3. Poprawić obsługę rate-limitów w auto-publish

Obecnie Facebook zwraca rate-limit, ale system potrafi wracać do tego samego posta zbyt agresywnie.

Zmiana:

- jeżeli błąd platformy pasuje do rate-limit patternów, ustawiaj `status = rate_limited`,
- ustawiaj `next_retry_at` w przyszłości, np. `2h`,
- nie próbuj tego samego posta w kolejnych cyklach co 2 minuty,
- nie oznaczaj jako zwykły `failed`, jeśli to jest limit platformy.

### 4. Odblokować świeże kampanie mimo dużego backlogu

Dodać prostą sprawiedliwość w wyborze postów:

- nie pobierać tylko pierwszych 1000 najstarszych postów globalnie,
- ograniczyć liczbę postów na jedną kampanię w jednym cyklu, np. `3-5`,
- dzięki temu kampania z dzisiaj nie będzie czekać aż stare kampanie przemielą setki zaległości.

Najbezpieczniej zrobić to w Edge Function po pobraniu kandydatów: pobrać np. `200` kandydatów, a potem w kodzie wybrać maksymalnie `N` postów per campaign do lockowania/publikacji.

### 5. Dodać diagnostykę w UI szczegółów kampanii

W `src/pages/CampaignDetails.tsx` dodać widoczny stan, żeby użytkownik nie miał wrażenia, że „nic się nie dzieje”:

- liczba postów zaległych do publikacji,
- liczba `rate_limited`,
- najbliższa ponowna próba `next_retry_at`,
- jeśli są zaległe posty i zero publikacji, krótki komunikat: kampania czeka w kolejce / platforma ogranicza publikacje.

Bez przebudowy UI — tylko informacyjny alert w szczegółach kampanii.

### 6. Jednorazowe uporządkowanie danych

Po zmianie logiki warto wykonać bezpieczną migrację/SQL naprawczy:

- usunąć duplikaty UUID w `campaign_posts.target_accounts` dla każdego klucza platformy,
- ewentualnie ustawić stare `rate_limited` z przeszłym `next_retry_at` na przyszły retry, żeby nie wracały natychmiast wszystkie naraz.

Nie usuwać postów i nie zmieniać treści kampanii.

### 7. Walidacja

Po wdrożeniu:

- wywołać `auto-publish-books` testowo,
- sprawdzić logi, czy funkcja nie lockuje już `1000` postów,
- sprawdzić, czy jeden post nie publikuje 5 razy na to samo konto,
- sprawdzić, czy bieżąca kampania dostaje szansę publikacji mimo starszych zaległości,
- sprawdzić w UI, czy użytkownik widzi powód opóźnienia zamiast pustej ciszy.