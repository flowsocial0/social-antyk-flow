## Stan obecny — czego brakuje

Sprawdziłem `CampaignSetup.tsx`, `SimpleCampaignSetup.tsx` i `PlatformTikTok.tsx`. Mamy tylko walidację „TikTok wymaga wideo". **Brakuje wszystkich elementów UX wymaganych przez audyt TikToka:**

| Wymóg TikToka | Status u nas |
|---|---|
| Widoczna nazwa konta TikTok przy publikacji | ❌ brak (publikujemy do pierwszego znalezionego konta) |
| Wybór Privacy level (Public / Friends / Only me) z `creator_info/query` | ❌ brak w UI (kod EF używa hardcoded `PUBLIC_TO_EVERYONE` z fallbackiem na `SELF_ONLY`) |
| Disclosure: Disclose video content / Your brand / Branded content | ❌ brak |
| Link do TikTok Music Usage Confirmation | ❌ brak |
| Link do Branded Content Policy | ❌ brak |

Bez tego TikTok **odrzuci audyt** — to twarde wymagania ich review checklisty.

## Plan dorobienia

### 1. Nowa edge function `tiktok-creator-info`
- Wywołuje `POST /v2/post/publish/creator_info/query/` per `tiktok_oauth_tokens` rekord usera.
- Zwraca: `creator_username`, `creator_nickname`, `privacy_level_options[]`, `comment_disabled`, `duet_disabled`, `stitch_disabled`, `max_video_post_duration_sec`.
- Wywoływana z frontu przy wejściu w setup kampanii TikTok, aby pokazać realne opcje konta.

### 2. Nowy komponent `TikTokPublishOptions.tsx`
Pojawia się w `CampaignSetup` i `SimpleCampaignSetup`, gdy `targetPlatforms` zawiera `tiktok`. Zawiera:

- **Konto docelowe** — pole tekstowe / read-only badge z `@creator_username` + `display_name` (z `tiktok-creator-info`). Jeśli user ma kilka kont TikTok, dropdown wyboru.
- **Privacy level** — `<RadioGroup>` z opcjami zwróconymi przez `privacy_level_options` (typowo: `PUBLIC_TO_EVERYONE` / `MUTUAL_FOLLOW_FRIENDS` / `SELF_ONLY`). Etykiety PL: Publiczny / Znajomi / Tylko ja. Domyślnie `SELF_ONLY` zanim user wybierze (zgodnie z wytycznymi TikToka dla unaudited).
- **Interaction toggles** — 3 `<Switch>`: Zezwól na komentarze / Duet / Stitch. Wyszarzone, jeśli `comment_disabled`/`duet_disabled`/`stitch_disabled` z creator_info.
- **Disclosure section** (wymóg UX TikToka — musi być zawsze widoczna, nawet jeśli wyłączona):
  - `<Switch>` „Ujawnij treść wideo" (Disclose video content) — master toggle.
  - Po włączeniu pokazują się 2 checkboxy:
    - „Twoja marka" (Your brand) — promujesz własną markę/produkt.
    - „Treść markowa" (Branded content) — partnerstwo płatne z marką trzecią.
  - Walidacja: jeśli `Branded content = true`, to `privacy_level` nie może być `SELF_ONLY` (wymóg TikToka — pokażemy inline error).
- **Stopka z linkami** (zawsze widoczna pod sekcją):
  - „Publikując akceptujesz [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en) oraz [Branded Content Policy](https://www.tiktok.com/legal/page/global/bc-policy/en) TikToka."
  - Linki `target="_blank" rel="noopener noreferrer"`.

### 3. Zapis wyborów do bazy
- Rozszerzyć tabelę `campaigns` (lub `campaign_posts` jeśli per-post) o kolumny:
  - `tiktok_privacy_level text`
  - `tiktok_allow_comment bool default true`
  - `tiktok_allow_duet bool default true`
  - `tiktok_allow_stitch bool default true`
  - `tiktok_disclose_content bool default false`
  - `tiktok_brand_organic bool default false` (Your brand)
  - `tiktok_branded_content bool default false`
  - `tiktok_account_id uuid` (FK do `tiktok_oauth_tokens.id`, gdy user wybrał konkretne konto)

### 4. `publish-to-tiktok` — użyć wyborów usera
Zamiast hardcoded `PUBLIC_TO_EVERYONE` → `SELF_ONLY` fallback:
- Czytać `tiktok_privacy_level` i pozostałe flagi z rekordu posta/kampanii.
- W payloadzie `post/publish/video/init/` ustawiać `privacy_level`, `disable_comment`, `disable_duet`, `disable_stitch`, `brand_content_toggle`, `brand_organic_toggle`.
- Fallback `SELF_ONLY` zostaje tylko dla błędu `unaudited_client_can_only_post_to_private_accounts` (do czasu zatwierdzenia audytu).

### 5. `PlatformTikTok.tsx` — wzmocnić panel konta
Dodać pod `PlatformConnectionStatus`:
- Karta „Wymagania publikacji TikTok" z linkami do Music Usage Confirmation + Branded Content Policy + krótki opis Privacy/Disclosure (żeby było widać też poza ekranem kampanii — TikTok recenzenci często sprawdzają i tutaj).

### 6. Treści PL do skopiowania
Przygotuję dokładne mikroteksty (etykiety, helper textów, walidacje) zgodne z brzmieniem wymaganym przez TikTok policy.

## Kolejność implementacji (po akceptacji)

1. Migracja DB (kolumny na campaigns + opcjonalnie campaign_posts).
2. Edge function `tiktok-creator-info` + deploy.
3. Komponent `TikTokPublishOptions.tsx`.
4. Wpięcie do `CampaignSetup.tsx` i `SimpleCampaignSetup.tsx` (pojawia się, gdy TikTok w `targetPlatforms`).
5. Aktualizacja `publish-to-tiktok` na nowe pola.
6. Wzbogacenie `PlatformTikTok.tsx` o sekcję policy/links.
7. Smoke test: połącz konto → utwórz kampanię → sprawdź czy widać wszystkie elementy (do nagrania).

## Co po Twojej stronie

Po wdrożeniu zostaje tylko nagrać 3 sekwencje (autoryzacja → ekran publikacji z widocznymi nowymi elementami → potwierdzenie + post na koncie TikTok) i wysłać audyt. Kod fallbacku `SELF_ONLY` zostawiamy, więc nadal możesz testować na koncie prywatnym do czasu zatwierdzenia.

Czy akceptujesz plan?
