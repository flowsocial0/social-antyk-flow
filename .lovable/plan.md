

## Plan: Usunięcie wszystkich limitów X z aplikacji

X jest teraz płatny za każdy post — nie ma już żadnych limitów dziennych/miesięcznych. Jedyne limity, które powinny pozostać, to te zwracane przez samo API X (429), ale nasza aplikacja nie powinna ich sztucznie wymuszać.

### Zlokalizowane miejsca z limitami X

| # | Plik | Co robi | Linia(e) |
|---|------|---------|----------|
| 1 | `supabase/functions/publish-to-x/index.ts` | `X_FREE_TIER_DAILY_LIMIT = 50` — blokuje publikację po 50 postach/24h | 7-11 |
| 2 | `supabase/functions/publish-to-x/index.ts` | `X_FREE_TIER_MONTHLY_LIMIT = 500` — blokuje po 500/miesiąc | 11 |
| 3 | `supabase/functions/publish-to-x/index.ts` | `checkDailyPublicationLimit()` — cała funkcja licząca posty w 24h | 233-277 |
| 4 | `supabase/functions/publish-to-x/index.ts` | `checkMonthlyPublicationLimit()` — cała funkcja licząca posty w 30 dni | 280-328 |
| 5 | `supabase/functions/publish-to-x/index.ts` | Wywołanie `checkDailyPublicationLimit` przed kampanią — blokuje post | 1012-1042 |
| 6 | `supabase/functions/publish-to-x/index.ts` | Wywołanie `checkDailyPublicationLimit` przed każdą książką | 1344-1355 |
| 7 | `supabase/functions/publish-to-x/index.ts` | Obsługa 429 z komunikatem o "Free tier" i dziennym limicie | 710-718 |
| 8 | `supabase/functions/publish-to-x/index.ts` | `isDailyLimit` w catch — ustawia `DAILY_LIMIT`, retry z długimi opóźnieniami | 1243-1298 |
| 9 | `supabase/functions/get-x-rate-limits/index.ts` | `X_APP_DAILY_LIMIT = 50` — cała edge function służy do pokazywania limitu | cały plik |
| 10 | `supabase/functions/get-platform-limits/index.ts` | `x.free.daily: 17, x.free.monthly: 500, x.basic.daily: 100` | 12-19 |
| 11 | `src/components/platforms/XRateLimitStatus.tsx` | Cały komponent UI pokazujący "Limit aplikacji X (24h)" | cały plik |
| 12 | `src/pages/platforms/PlatformX.tsx` | `<XRateLimitStatus />` — import i wyświetlanie widgetu | 8, 27 |
| 13 | `src/components/campaigns/CampaignSetup.tsx` | `Math.min(value, 10)` z komentarzem "X/Twitter daily limit for free tier" | 82-83 |
| 14 | `supabase/functions/auto-publish-books/index.ts` | `x: { maxPosts: 100, windowMinutes: 1 }` z komentarzem "max 15/day on free tier" | 140 |

### Plan zmian

**1. `supabase/functions/publish-to-x/index.ts`**
- Usunąć stałe `X_FREE_TIER_DAILY_LIMIT` i `X_FREE_TIER_MONTHLY_LIMIT`
- Usunąć funkcje `checkDailyPublicationLimit()` i `checkMonthlyPublicationLimit()`
- Usunąć wywołania tych funkcji przed kampanią (linie 1012-1042) i przed książkami (1344-1355)
- W obsłudze 429: zostawić sam retry na API 429 (to realne limity od X), ale usunąć komunikaty o "Free tier" i "dziennym limicie"
- W catch: uprościć — usunąć `isDailyLimit` ścieżkę, traktować 429 jako zwykły API rate-limit z krótkim retry
- Zachować `savePublication()` (tracking do `x_daily_publications`) — przydatne do statystyk, ale nie do blokowania

**2. `supabase/functions/get-x-rate-limits/index.ts`**
- Usunąć stałą `X_APP_DAILY_LIMIT`
- Przerobić funkcję: zamiast zwracać "remaining vs limit", zwracać tylko statystyki publikacji (ile opublikowano w 24h) bez oznaczania jako "is_limited"
- Albo usunąć tę edge function całkowicie, jeśli UI widget też usuwamy

**3. `supabase/functions/get-platform-limits/index.ts`**
- Usunąć sekcję `x.free` i `x.basic` z `PLATFORM_LIMITS` albo ustawić bardzo wysokie wartości (np. 99999) żeby nie blokować

**4. `src/components/platforms/XRateLimitStatus.tsx`**
- Usunąć cały komponent (nie ma sensu pokazywać limitu, który nie istnieje)

**5. `src/pages/platforms/PlatformX.tsx`**
- Usunąć import i użycie `<XRateLimitStatus />`

**6. `src/components/campaigns/CampaignSetup.tsx`**
- Usunąć `Math.min(value, 10)` — pozwolić na dowolną liczbę postów dziennie (lub ustawić rozsądny max UI np. 50)
- Usunąć komentarz o "X/Twitter daily limit for free tier"

**7. `supabase/functions/auto-publish-books/index.ts`**
- Usunąć komentarz "max 15/day on free tier" przy `x: { maxPosts: 100, windowMinutes: 1 }`
- Zachować sam throttling (100/1min) jako ochronę przed spamem — to nie jest limit X, to nasz wewnętrzny throttle

**Co zostaje:**
- Obsługa API 429 od X (realne limity serwera) — ale bez komunikatów o "Free tier"
- Zapis do `x_daily_publications` — do statystyk
- Wewnętrzny throttling w `auto-publish-books` — ochrona przed spamem
- Tabela `platform_rate_limits` — do śledzenia API headers

