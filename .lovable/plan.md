

## Problem: Projekt nadal zablokowany (402) mimo TRUNCATE

### Stan po TRUNCATE

```text
DATABASE: 40 MB ✅ (było 347 MB - TRUNCATE zadziałał!)
STORAGE:  291 MB (pliki nadal na dysku)
├── 644dcc40.../   118 MB  (42 osierocone pliki)
├── books/          61 MB  (używane)
├── videos/         39 MB
├── ac74eee0.../    35 MB  (35 osieroconych plików)
├── temp-videos/    31 MB  (4 pliki)
└── inne             7 MB
```

Supabase nadal blokuje projekt (`exceed_storage_size_quota`). Crony `auto-publish-every-2-minutes` i `cleanup-temp-videos-hourly` wywołują edge functions co 2 min / co godzinę, każde wywołanie zwraca 402 i generuje dodatkowy egress. To pogarsza sytuację.

### Plan naprawy (2 kroki)

**Krok 1: Wstrzymanie wszystkich HTTP cronów (migracja SQL)**

Wyłączę (unschedule) dwa crony wywołujące Edge Functions:
- `auto-publish-every-2-minutes` (jobid 7)
- `cleanup-temp-videos-hourly` (jobid 4)

Zostawiam crony czyszczące SQL (nie wywołują HTTP):
- `cleanup-cron-job-details-daily` (jobid 8) 
- `cleanup-http-response-daily` (jobid 6)

**Krok 2: Ręczne usunięcie osieroconych plików (~184 MB)**

Edge Functions są zablokowane (402), więc nie mogę usunąć plików programowo. Musisz to zrobić ręcznie w Supabase Dashboard → Storage → ObrazkiKsiazek:

1. Usuń **cały folder** `644dcc40-a8ec-4125-b340-0b3a6e068683` (118 MB, 42 pliki)
2. Usuń **cały folder** `ac74eee0-0b37-49cb-8c66-3185c92384ea` (35 MB, 35 plików)
3. Usuń **cały folder** `temp-videos` (31 MB, 4 pliki)

To zwolni ~184 MB. Po tym Supabase powinien zdjąć blokadę (metryki odświeżają się co kilka godzin do 24h).

**Po odblokowaniu** -- stworzę nową migrację przywracającą crony auto-publish (co 2 min) i cleanup-temp-videos (co godzinę).

### Oczekiwany efekt

```text
Database:  40 MB (już OK)
Storage: 291 MB → ~107 MB
Łącznie: ~147 MB (bezpiecznie w limicie)
```

