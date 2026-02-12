
# Czytelne komunikaty bledow zamiast "Edge Function non-2xx"

## Problem

Trzy edge functions zwracaja HTTP 500 przy bledach, co powoduje ze klient Supabase wyrzuca ogolny blad "Edge Function returned a non-2xx status code" zamiast konkretnej wiadomosci o problemie. Uzytkownik widzi niezrozumialy komunikat techniczny.

Dotyczy to:
- `generate-campaign` (generowanie kampanii)
- `generate-sales-text` (generowanie tekstow AI)
- `auto-publish-books` (zewnetrzny catch)

Funkcje publikacji (publish-to-x, publish-to-facebook, itd.) sa juz poprawnie zaimplementowane — zwracaja HTTP 200 z `success: false`.

## Plan naprawy

### 1. Edge function: `generate-campaign`
Zmiana statusu z 500 na 200 w catch, dodanie `success: false` w odpowiedzi.

### 2. Edge function: `generate-sales-text`
Zmiana statusu z 500 na 200 w catch, dodanie `success: false` i czytelnej wiadomosci.

### 3. Edge function: `auto-publish-books`
Zmiana statusu z 500 na 200 w zewnetrznym catch (linia ~664).

### 4. Frontend: Lepsze parsowanie bledow

Wszystkie miejsca w kodzie, ktore uzywaja `supabase.functions.invoke` i wyswietlaja bledy, beda sprawdzac rowniez `data?.error` i `data?.message` obok `error.message`, zeby wyswietlic uzytkownikowi konkretna przyczyne.

Dotyczy glownie:
- `PlatformBooksList.tsx` — onError w mutacjach (generate AI text, publish)
- `ExpressCampaignLaunch.tsx` — launchAllCampaigns
- `CampaignDialog.tsx` — generowanie kampanii
- `PlatformAITextDialog.tsx` — generowanie tekstu AI

### Efekt

Zamiast "Edge Function returned a non-2xx status code" uzytkownik zobaczy np.:
- "Nie udalo sie wygenerowac tekstu: przekroczono limit API"
- "Blad generowania kampanii: brak klucza API"
- "Wystapil blad podczas automatycznej publikacji: ..."

## Zakres zmian

| Plik | Zmiana |
|------|--------|
| `supabase/functions/generate-campaign/index.ts` | status 500 na 200 + success: false |
| `supabase/functions/generate-sales-text/index.ts` | status 500 na 200 + success: false |
| `supabase/functions/auto-publish-books/index.ts` | status 500 na 200 + success: false |
| `src/components/platforms/PlatformBooksList.tsx` | Parsowanie data?.error w onError |
| `src/components/platforms/PlatformAITextDialog.tsx` | Parsowanie data?.error |
| `src/pages/ExpressCampaignLaunch.tsx` | Parsowanie data?.error |
| `src/components/books/CampaignDialog.tsx` | Parsowanie data?.error |
