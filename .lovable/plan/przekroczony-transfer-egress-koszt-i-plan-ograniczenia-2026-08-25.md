# Przekroczony transfer (egress) — koszt i plan ograniczenia

## Ile to kosztuje

- Plan Pro zawiera 250 GB egress; zużycie w okresie: 315,58 GB, czyli 65,58 GB ponad limit.
- Supabase liczy nadwyżkę egress po 0,09 USD/GB → **ok. 5,90 USD dodatkowo w tym okresie rozliczeniowym**.
- Projekt nie zostaje zablokowany za nadwyżkę — jest doliczana do faktury. Przy obecnym tempie (~20-25 GB/dobę wg wykresu) kolejny pełny miesiąc to ok. 600-700 GB, czyli ok. 35-40 USD nadwyżki miesięcznie, jeśli nic nie zmienimy.

## Co widać w danych (sprawdzone, nie domysły)

- W logach API z ostatniej doby dominują pliki `temp-videos/*` w buckecie `ObrazkiKsiazek`: **ten sam post pobiera i wystawia publicznie ten sam film co ~5 minut** (np. post `eec177b0…` o 1787637902 i ponownie 1787638202). Każda taka próba to pełne pobranie pliku z Mega, upload do Storage i publiczne pobranie przez platformę — czyli wielokrotność rozmiaru pliku w egress przy każdym przebiegu crona.
- Kolejka `campaign_posts`: 2088 `scheduled`, 2306 `paused`, 89 `rate_limited`, 20 `failed`. Posty z wideo: 76.
- Publikacji dziennie jest tylko ok. 70-130, a transfer to ~20-25 GB/dobę — więc egress nie pochodzi z udanych publikacji, tylko z **powtarzanych, nieudanych prób z wideo**.
- Wideo w bibliotece jest niewiele (2 pliki, 69,9 MB + 1 link Mega), co potwierdza: to nie objętość biblioteki, tylko pętla ponawiania.

## Plan ograniczenia transferu

### A. Zatrzymać pętlę ponawiania wideo (największy efekt)

1. Twardy licznik prób na post: po 3 nieudanych próbach publikacji z mediami post przechodzi w stan końcowy `failed` z czytelnym błędem, zamiast wracać do kolejki co 5 minut.
2. Wykładniczy backoff zamiast stałych 5 minut: 15 min → 1 h → 4 h.
3. Reużycie pliku tymczasowego: jeśli dla danego posta istnieje już świeży plik w `temp-videos` (młodszy niż X godzin), nie pobierać ponownie z Mega ani nie wgrywać od nowa.
4. Jednorazowe porządki: zamknąć wiszące posty `rate_limited`/`failed` starsze niż 3 dni, żeby nie krążyły w kolejce.

### B. Przestać wystawiać wideo publicznie bez potrzeby

5. Zamiast publicznego URL do `temp-videos` używać podpisanego URL o krótkim czasie życia — ten sam efekt dla platform, ale plik nie jest pobieralny w nieskończoność przez boty i cache.
6. Sprzątanie `temp-videos` natychmiast po publikacji (dziś zdarza się, że pliki zostają do przebiegu cleanupu).

### C. Zmniejszyć transfer poza wideo

7. Ustawić `Cache-Control` na okładkach książek w Storage (dziś domyślnie krótki) — obrazy z `ObrazkiKsiazek` są pobierane przy każdym wejściu na listy książek i kampanii.
8. Zawęzić `select("*")` w listach książek/kampanii do potrzebnych kolumn (m.in. `ai_generated_text`, `description` potrafią ważyć najwięcej w odpowiedziach REST).

### D. Kontrola

9. W panelu admina (`ResourceMonitor`) dodać licznik prób resolucji wideo i liczbę plików w `temp-videos`, żeby taka pętla była widoczna od razu, a nie dopiero na fakturze.

## Szczegóły techniczne

- Pliki: `supabase/functions/auto-publish-books/index.ts` (retry, backoff, cache pliku tymczasowego, podpisane URL), `supabase/functions/cleanup-temp-videos/index.ts`, `src/components/admin/ResourceMonitor.tsx`, listy książek/kampanii w `src/components/books/*` i `src/pages/CampaignDetails.tsx`.
- Migracja: kolumny/indeks pod licznik prób (`retry_count` już istnieje — wykorzystać go w warunku kolejki) oraz jednorazowy update starych statusów.
- Zmiana `Cache-Control` bucketu przez narzędzie konfiguracji Storage.

## Czego oczekiwać

Po A+B transfer powinien spaść z ~20-25 GB/dobę do rzędu pojedynczych GB — czyli poniżej progu 250 GB w miesiącu i bez nadwyżki na fakturze.  
  
  
Komentarz od użytkownika:   
z literki A punkt "2. Wykładniczy backoff zamiast stałych 5 minut: 15 min → 1 h → 4 h." nie realizuje. od razu podejmij 3 próby max i napisz, że błąd z czytelną wiadomością co sie zesrało. Użytkownik musi od razu wiedzie czy idzie i czemu nie idzie. Już przy pierwszej nieudanej próbie wyraźnie napisz, że jest problem z pobieraniem i że ponawiasz próby.