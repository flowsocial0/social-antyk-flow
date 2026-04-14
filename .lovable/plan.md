<final-text>Co ustaliłem

1. X nie stał już przez dawny limit `1 post / 30 min` w `auto-publish-books`. Ten fragment jest teraz podniesiony do `100 / 1 min`, więc to nie on blokował wczoraj.
2. Nadal istnieją jednak dwie inne blokady X:
   - `publish-to-x` ma twardo wpisany limit `15 tweetów / 24h`
   - ta sama funkcja reaguje też na API 429 / daily-limit i ustawia `campaign_posts.status = rate_limited` z `next_retry_at`
3. Najważniejszy błąd jest potem w `auto-publish-books`: gdy `publish-to-x` zwraca odpowiedź limitową, scheduler rozpoznaje, że to rate-limit, ale gubi tę informację przy finalnym zapisie statusu. W praktyce:
   - nie zapisuje szczegółu limitu do `accountErrors`
   - tworzy ogólny komunikat `X (Twitter): Nie udało się opublikować na żadne konto.`
   - na końcu nadpisuje post na `failed / PUBLISH_FAILED`
4. To dokładnie tłumaczy objaw zgłoszony przez użytkownika:
   - backend chwilowo wie, że trzeba poczekać i ma `next_retry_at`
   - ale scheduler kasuje ten stan
   - post nie wznawia się sam
   - użytkownik musi klikać ręczne „Wyślij ponownie”

Dlaczego więc X stanął wczoraj

Najbardziej prawdopodobny scenariusz jest taki:
```text
X wpada w ścieżkę limitu / 429 / daily-limit
-> publish-to-x ustawia rate_limited + next_retry_at
-> auto-publish-books odbiera success:false
-> gubi informację, że to limit
-> zamienia to na zwykły failed
-> auto retry przestaje działać
-> użytkownik ręcznie ponawia
```

Dodatkowe rzeczy, które to pogarszają

- `publish-to-x` i `get-x-rate-limits` nadal bazują na sztywnej wartości `15/doba`, więc samo „przesunięcie wewnętrznych limitów” nie usunęło wszystkich blokad X.
- UI kampanii ma osobne ręczne retry:
  - pojedynczy post ustawia retry za 2 minuty
  - „Ponów wszystkie” rozkłada błędne posty co 30 minut
  To dodatkowo wzmacnia wrażenie, że system działa tylko po ręcznym szturchaniu.

Pliki wskazujące na problem

- `supabase/functions/publish-to-x/index.ts`
  - hardcoded `15/24h`
  - ustawianie `rate_limited` i `next_retry_at`
- `supabase/functions/auto-publish-books/index.ts`
  - wykrycie rate-limit bez zachowania statusu
  - późniejsze nadpisanie na `failed`
- `src/pages/CampaignDetails.tsx`
  - ręczne retry failed posts z rozstawem 30 min

Plan naprawy

1. Poprawić `auto-publish-books`, żeby nie nadpisywał limitów X na zwykły `failed`
   - zachować `rate_limited`
   - zachować `next_retry_at`
   - nie generować ogólnego błędu „nie udało się na żadne konto”, jeśli przyczyna była limitowa
2. Ujednolicić kody błędów X między funkcjami
   - obecnie mieszają się `DAILY_LIMIT`, `X_API_DAILY_LIMIT`, `X_DAILY_LIMIT`, `429`, `X_RATE_LIMIT`
   - scheduler ma dostać jeden spójny sygnał: „to jest auto-retry, nie failure”
3. Zweryfikować limit `15/24h` w `publish-to-x` oraz `get-x-rate-limits`
   - jeśli ten limit ma zostać, musi być jasno komunikowany
   - jeśli nie jest już aktualny, trzeba go usunąć z obu miejsc, nie tylko z `auto-publish-books`
4. Doprecyzować UI kampanii
   - osobno pokazywać `failed` i `rate_limited`
   - wyraźnie pokazać: „system wznowi automatycznie o ...”
   - ograniczyć potrzebę ręcznego retry
5. Po wdrożeniu zrobić test end-to-end
   - wymusić odpowiedź limitową z X
   - sprawdzić, że post zostaje w `rate_limited`
   - sprawdzić, że cron podnosi go automatycznie po `next_retry_at`
   - potwierdzić, że użytkownik nie musi nic klikać

Uwaga techniczna

W repo jest też bieżący problem builda z `megajs` w `auto-publish-books`. To nie wygląda na główną przyczynę wczorajszego zatrzymania X, ale trzeba to naprawić w tym samym podejściu, bo może blokować bezpieczne wdrożenie kolejnej poprawki.</final-text>