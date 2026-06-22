## Kontekst

1. **X.com** — zgodnie z aktualną polityką (mem: X Rate Limits) nie ma już żadnych sztucznych dziennych limitów, jedynie anty-spam 100/min po stronie edge function. Stałe `X_DAILY_LIMIT = 10` i `X_MAX_CAMPAIGN_POSTS = 60` w `CampaignSetup.tsx` (135–144, 415–435) są pozostałością i błędnie blokują legalne kampanie (np. 26 × 3 = 78 postów).
2. **TikTok** — w `src/config/platforms.ts` (linia 120) i w UI `SocialAccounts.tsx` (515, 568) ma `status: 'review'`. Użytkownik potwierdził, że dostali zgodę i można uruchamiać produkcyjnie dla wszystkich.

Przegląd reszty kreatora kampanii: poza X-em nie ma innych „sztucznych" limitów po stronie frontu — slider `postsPerDay` jest ograniczony do 10 wyłącznie ze względu na ergonomię UI (komunikat „Maksymalnie 10 postów dziennie (limit API X)"). Zostanie złagodzony razem z X.

## Zakres zmian

### 1. `src/components/campaigns/CampaignSetup.tsx`
- **Usunąć** stałe `X_DAILY_LIMIT`, `X_MAX_CAMPAIGN_POSTS`, zmienne `hasX`, `usesAI`, `exceedsXLimit` (linie 140–144).
- **Usunąć** cały blok ostrzeżenia/blokady X.com (linie ~415–435: czerwony alert + dezaktywacja przycisku „Przekroczono limit … dla X.com").
- **Usunąć** podpis pod sliderem „Maksymalnie 10 postów dziennie (limit API X)" jeśli odnosi się tylko do nieistniejącego limitu (zostawić tylko informację o górnej granicy slidera = 10, neutralny tekst „Maksymalnie 10 postów dziennie").
- Slider `postsPerDay` zostaje w obecnym zakresie 1–10 (UX), bez zmian.
- Submit button nie zależy już od `exceedsXLimit`.

### 2. `src/config/platforms.ts`
- Zmienić `tiktok.status` z `'review'` na `'active'` (linia 120).

### 3. `src/pages/SocialAccounts.tsx`
- Zmienić wpis TikTok (linia 515) `status: 'review' as const` → `status: 'active' as const`, żeby zniknął badge „W weryfikacji" pokazywany w 568.

### Out of scope
- Brak zmian w edge functions (X anty-spam 100/min i logika TikToka działają).
- Brak zmian w `is_sandbox` w bazie — flaga zostaje na poziomie konta i nie wpływa na publiczność platformy.
- Pinterest i YouTube zostają w `'review'` — nie były objęte prośbą.

## Walidacja
- 3 posty/dzień × 26 dni (78 łącznie) z X w platformach → kampania przechodzi, brak czerwonego alertu.
- TikTok pojawia się jako w pełni aktywna platforma w `/platforms` i `/accounts` bez plakietki „W weryfikacji".
- Bez regresji w pozostałych platformach kreatora.