## Problem

Badge „Połączono” i sekcja „Wybór kont do publikacji” korzystają z dwóch różnych zapytań:

- `AccountSelector.tsx` — pobiera konta **z filtrem** `.eq('user_id', session.user.id)` → dlatego pokazuje „YouTube nie ma połączonych kont”.
- `CampaignSetup.tsx` i `SimpleCampaignSetup.tsx` (funkcje `checkConnectedPlatforms`) — robią `.select('id').limit(1).maybeSingle()` **bez filtra user_id**.

Zweryfikowane w bazie: tabele tokenów mają obok polityki `auth.uid() = user_id` również politykę `Admins can view all <platform> tokens` (`has_role(auth.uid(),'admin')`). Dla konta administratora zapytanie bez filtra zwraca **cudze** tokeny → badge pokazuje „Połączono”, mimo że użytkownik nie ma własnego konta. To dokładnie odpowiada zrzutom: YouTube/Bluesky „Połączono”, a lista kont pusta (TikTok: 1 konto, YouTube: brak).

Dodatkowo: `maybeSingle()` na tabeli z wieloma wierszami bywa źródłem błędów, a `CampaignSetup` sprawdza tylko 6 platform (reszta zawsze „Wymaga połączenia”), podczas gdy `SimpleCampaignSetup` sprawdza 12 — dwie niespójne implementacje.

## Rozwiązanie

1. **Nowy wspólny hook** `src/hooks/useConnectedAccounts.ts`:
   - jedno zapytanie na platformę, zawsze `.eq('user_id', session.user.id)`, `select('id', { count: 'exact', head: true })` zamiast `maybeSingle()`,
   - zwraca `connectedPlatforms: Record<PlatformId, boolean>` oraz `accountCounts: Record<PlatformId, number>` i `loading`,
   - jedna mapa `platformId → tabela` (wszystkie 12 platform) jako źródło prawdy.

2. **`CampaignSetup.tsx`** — usunięcie lokalnego `checkConnectedPlatforms` (6 platform, bez filtra) i użycie hooka.

3. **`SimpleCampaignSetup.tsx`** — to samo: usunięcie lokalnej funkcji, użycie hooka.

4. **`PlatformSelector.tsx`** — badge pokazuje liczbę kont zamiast samego „Połączono” (np. „Połączono · 2 konta”), a przy 0 kontach zawsze „Wymaga połączenia”. Dzięki temu status w obu sekcjach nie może się już rozjechać.

## Uwagi techniczne

- Zmiana jest wyłącznie po stronie frontendu — bez migracji i bez zmian polityk RLS (polityki admina zostają, ale UI nie będzie już na nich polegać).
- Zgodne z zasadą projektu: każde zapytanie musi jawnie filtrować po `user_id`.
