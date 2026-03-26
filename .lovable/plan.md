

## Analiza zgłoszenia: "179 błędów w kampanii"

### Przyczyna błędów

Kampania o ID `5517d097` nie istnieje już w bazie (prawdopodobnie została usunięta i odtworzona jako "kontynuacja"). Jednak wzorzec błędów jest jasny -- przeanalizowałem wszystkie kampanie użytkownika `antyk@ksiegarnia.pl`:

```text
ROZKŁAD BŁĘDÓW WG PRZYCZYNY:
├── Instagram "too many actions"          193 błędów (34%)
├── X (Twitter) limit 15 tweetów/dzień    231 błędów (41%)
├── Facebook antyspam                      62 błędów (11%)
├── LinkedIn throttle dziennego limitu     42 błędów (7%)
├── Mega.nz download failure               ~40 błędów (7%)
└── RAZEM                                ~568 failed postów
```

**Główna przyczyna**: Platformy blokują publikacje, gdy jest ich za dużo w krótkim czasie. System publikuje posty z wielu kampanii jednocześnie, co powoduje przekroczenie limitów platform.

**Dlaczego nie zrobił zrzutu ekranu**: `html2canvas` może cicho zawieść na stronach z dużą ilością elementów DOM (tabela z 179+ wierszami) lub przy cross-origin zasobach. Formularz otwiera się mimo to, ale bez screenshota.

### Plan naprawy

#### 1. Inteligentne limitowanie w `auto-publish-books`

Obecnie system publikuje wszystkie gotowe posty naraz. Trzeba dodać **limity per platforma per konto per interwał**:

- X/Twitter: max 1 tweet / 30 min per konto (max 15/dzień na free)
- Instagram: max 1 post / 30 min per konto
- Facebook: max 2 posty / godzinę per stronę
- LinkedIn: max 1 post / godzinę per konto

Posty, które nie zmieszczą się w limicie, dostaną status `rate_limited` z `next_retry_at` ustawionym na następny dostępny slot -- zamiast `failed`.

Zmiany w `auto-publish-books/index.ts`:
- Przed publikacją sprawdź ile postów opublikowano z danego konta w ostatnich N minutach
- Jeśli limit przekroczony → ustaw `rate_limited` + `next_retry_at` zamiast próbować i dostać `failed`
- Posty `rate_limited` są już obsługiwane w query (linia 186)

#### 2. Retry dla postów `failed` z błędami rate-limit

Nowa logika: posty z `error_code = 'PUBLISH_FAILED'` i komunikatem zawierającym "too many actions", "throttle", "ograniczamy liczbę" powinny automatycznie przejść na `rate_limited` zamiast `failed`, z retry za 2 godziny.

#### 3. Poprawka screenshota w `BugReportButton`

Dodanie `try-catch` z fallbackiem + timeout 10s dla `html2canvas`. Jeśli screenshot się nie uda, formularz otworzy się bez niego ale z informacją "Nie udało się wykonać zrzutu ekranu".

#### 4. Panel kampanii -- widoczność błędów

W widoku szczegółów kampanii (`CampaignDetails`) dodać podsumowanie błędów z kategoryzacją (rate limit vs real error) i przycisk "Ponów publikację nieudanych postów" który zmienia status `failed` → `scheduled`.

### Szczegóły techniczne

**Plik: `supabase/functions/auto-publish-books/index.ts`**
- Dodanie funkcji `checkAccountRateLimit(supabase, accountId, platform)` -- query do `campaign_posts` sprawdzającej ile postów opublikowano w ostatnich 30/60 min
- Modyfikacja pętli publikacji: skip kont ponad limitem, ustaw `rate_limited`
- W catch-u: rozpoznanie błędów rate-limit i zmiana statusu na `rate_limited` zamiast `failed`

**Plik: `src/components/bugs/BugReportButton.tsx`**
- Timeout 10s na `html2canvas`
- Graceful fallback bez screenshota

**Plik: `src/components/campaigns/CampaignPostCard.tsx` lub `CampaignDetails.tsx`**
- Podsumowanie błędów z kategoryzacją
- Przycisk "Ponów nieudane posty"

