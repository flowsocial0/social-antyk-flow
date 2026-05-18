## Przegląd zgłoszeń od użytkowników

Sprawdziłem tabelę `bug_reports`. Najnowsze, otwarte zgłoszenie (07.05.2026):

**„Nie dziala wznowienie kampanii"** — kampania `dfd66aac…` na X, użytkownik wznawia i posty się nie publikują.

Sprawdziłem kampanię w bazie:
- 56 postów `failed`, wszystkie z identycznym błędem:
- `Failed to send tweet: 402, body: {"title":"CreditsDepleted","detail":"Your enrolled account ... does not have any credits to fulfill this request.","type":".../credits"}`
- 304 postów wciąż `scheduled` — czekają w kolejce i będą padać tak samo

To nie jest błąd aplikacji — X **wyłączył darmowe API**, a konto użytkownika nie ma wykupionych kredytów. Ale aplikacja:

1. Pokazuje to jako `error_code = 'unknown'` zamiast jasnego „brak kredytów na X"
2. Wciąż próbuje publikować (302 postów w kolejce → 302 kolejnych failów, marnowanie wywołań API)
3. Nie informuje użytkownika, że musi doładować konto X — on widzi tylko „nie dziala" i się denerwuje

Starsze zgłoszenia (z marca/kwietnia) dotyczyły wygasłych tokenów, problemów FB i kampanii — w międzyczasie były naprawiane.

## Co zrobić

### 1. `supabase/functions/publish-to-x/index.ts` — rozpoznać 402

W `sendTweet()` (linie 583-616) dodać przed `default error`:

```ts
if (response.status === 402) {
  let detail = responseText;
  try {
    const parsed = JSON.parse(responseText);
    detail = parsed?.detail || parsed?.title || responseText;
  } catch {}
  const error = new Error(
    `Brak kredytów na koncie X. X API jest płatne — doładuj konto na https://developer.x.com lub wyłącz publikację na X. Szczegóły: ${detail}`
  );
  (error as any).statusCode = 402;
  (error as any).errorCode = 'X_CREDITS_DEPLETED';
  (error as any).permanent = true;  // nie retryować
  throw error;
}
```

W `sendTweetWithRateLimitTracking()` — nie wchodzić w pętlę retry gdy `error.permanent === true`.

W głównym handlerze (linie ~1100-1170) dodać gałąź:
```ts
if (error.errorCode === 'X_CREDITS_DEPLETED' || error.statusCode === 402) {
  // zapisz post jako failed z error_code='X_CREDITS_DEPLETED'
  // NIE ustawiaj next_retry_at — to nie jest rate limit, tylko brak środków
}
```

### 2. `supabase/functions/auto-publish-books/index.ts` — zatrzymać masakrę

Gdy w ciągu jednego cyklu cron napotka post X z `error_code = 'X_CREDITS_DEPLETED'`, pominąć wszystkie pozostałe posty X tej samej kampanii dla tego konta w tym cyklu (i kolejnych — dopóki user nie zresetuje statusu ręcznie). Zapobiega to:
- marnowaniu prób na 304 zaplanowanych postach,
- spamowaniu logów,
- mnożeniu identycznych failów w UI.

Dodać `'X_CREDITS_DEPLETED'` do mapy znanych error_codes, żeby UI go ładnie etykietował.

### 3. `src/pages/CampaignDetails.tsx` — przyjazny komunikat

W sekcji kategorii błędów dodać kategorię „Brak kredytów na X" z:
- ikoną i kolorem ostrzegawczym,
- jednozdaniowym wyjaśnieniem „X API jest płatne. Konto nie ma kredytów — doładuj na developer.x.com",
- linkiem do dokumentacji X,
- przyciskiem „Wyłącz X w tej kampanii" zamiast bezsensownego „Spróbuj ponownie".

Ukryć ten typ błędu z licznika „błędów do retry" — to nie jest błąd techniczny.

### 4. Jednorazowy backfill (opcjonalnie, do potwierdzenia)

Czy chce Pan, żebym przy okazji oznaczył 56 istniejących failów w kampanii `dfd66aac…` jako `X_CREDITS_DEPLETED` i opcjonalnie wstrzymał 304 oczekujące posty X tej kampanii do czasu, aż użytkownik doładuje X lub usunie X z platform? Jeśli tak — dodam to jako migrację.

## Po wdrożeniu — test

1. Wymusić błąd 402 (mock) → potwierdzić, że post dostaje `error_code = 'X_CREDITS_DEPLETED'`, nie ma `next_retry_at`, cron go pomija.
2. Otworzyć kampanię w UI → widać kategorię „Brak kredytów na X" z linkiem i przyciskiem „Wyłącz X".
3. Sprawdzić, że pozostałe posty (FB/IG/LinkedIn) tej samej kampanii publikują się normalnie.

## Uwaga techniczna

Wzorzec `'CreditsDepleted'` jest już w `RATE_LIMIT_ERROR_PATTERNS` w `auto-publish-books`, ale to błędna klasyfikacja — to nie rate limit, tylko brak środków. Należy go stamtąd usunąć i obsłużyć osobno (jak wyżej), inaczej cron retryuje to w nieskończoność co 2 minuty.
