

## Diagnoza: Dlaczego rate limiting NIE DZIAŁA

Znalazłem **dwa krytyczne bugi** w `auto-publish-books`:

### Bug 1: Rate limit check odpytuje pustą tabelę

Funkcja `checkAccountRateLimit` sprawdza tabelę `platform_publications`, ale **X, Facebook, Instagram, LinkedIn, TikTok, Bluesky, Mastodon, Telegram, Gab** -- ŻADNA z tych platform NIE zapisuje danych do `platform_publications` po publikacji. Tylko Pinterest, Discord, Tumblr i Google Business to robią.

Wynik: `checkAccountRateLimit()` zawsze zwraca 0, throttling nigdy się nie uruchamia, wszystkie posty lecą naraz.

### Bug 2: Zmiana statusu na `rate_limited` wewnątrz pętli kont

Na liniach 554-563, gdy rate limit się (teoretycznie) uruchomi, kod ustawia status posta na `rate_limited` w wewnętrznej pętli kont, ale potem `continue` do następnego konta. Dla postów multi-platformowych to powoduje chaos -- status posta jest nadpisywany wielokrotnie.

## Plan naprawy

### 1. Zmiana strategii rate limitingu (auto-publish-books)

Zamiast polegać na `platform_publications` (która nie jest wypełniana), sprawdzam `campaign_posts` -- tabelę, która **zawsze** ma dane. Nowa logika:

- Przed publikacją posta na daną platformę, policz ile postów z danego **usera** na tej **platformie** zostało opublikowanych w ostatnich N minutach (query `campaign_posts` WHERE `status = 'published'` AND `published_at > since` AND user matches via campaign join)
- Usunięcie zależności od `platform_publications` i `accountId`

### 2. Przeniesienie rate limit check PRZED pętlę kont

Aktualnie rate check jest wewnątrz pętli kont i zmienia status posta -- to błąd. Przeniosę go przed pętlę platform: jeśli dana platforma jest over-limit, cały post zostaje w kolejce na `rate_limited` bez próby publikacji.

### 3. Dodanie `platform_publications` INSERT do brakujących platform

Dodanie zapisu do `platform_publications` po udanej publikacji w `auto-publish-books` (centralne miejsce) zamiast w każdej indywidualnej funkcji. To rozwiąże problem na przyszłość i da dokładniejsze dane.

### 4. Staggering postów w `retryAllFailed`

Zmiana w `CampaignDetails.tsx`: zamiast ustawiać wszystkie failed posty na tę samą datę (za 2 min), rozłożyć je w czasie -- każdy post +30min od poprzedniego. To zapobiegnie powtórzeniu problemu 179 błędów.

### Szczegóły techniczne

**auto-publish-books/index.ts:**
- Nowa `checkUserPlatformRateLimit(supabase, userId, platform, windowMinutes)` -- query `campaign_posts` JOIN `campaigns` po `user_id`, filtr `published_at` + `status = 'published'` + `platforms` contains platform
- Rate limit check przeniesiony na poziom platform loop (przed account loop)
- Po udanej publikacji: INSERT do `platform_publications` z `auto-publish-books`
- Dodanie globalnego limitu per cykl: max 3 posty per platforma per user per wywołanie cron (2 min)

**CampaignDetails.tsx:**
- `retryAllFailedMutation`: staggering -- post N planowany na `now + 2min + (N * 30min)`
- Komunikat informujący o rozłożeniu w czasie

**Publish functions (X, Facebook, Instagram, LinkedIn, TikTok, Bluesky, Mastodon, Telegram, Gab):**
- Nie zmieniamy -- zapis do `platform_publications` będzie centralnie w auto-publish-books

