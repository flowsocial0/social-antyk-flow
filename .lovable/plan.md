

## Problem: VACUUM FULL nie działa w SQL Editorze + projekt nadal zablokowany

### Dlaczego błąd?

SQL Editor Supabase domyślnie opakowuje zapytania w transakcję, a `VACUUM FULL` nie może działać w transakcji. To ograniczenie PostgreSQL.

### Aktualny stan (zweryfikowany)

```text
BAZA DANYCH: 347 MB
├── net._http_response    194 MB  (366 wierszy - same błędy 402!)
├── cron.job_run_details  114 MB  (10,674 wierszy - 7 dni logów)
└── dane aplikacji         39 MB

STORAGE: 291 MB (pliki)
├── 644dcc40.../          118 MB  (osierocone - 0 referencji)
├── books/                 61 MB  (używane)
├── videos/                39 MB
├── ac74eee0.../           35 MB  (osierocone - 0 referencji)
├── temp-videos/           31 MB  (4 pliki do usunięcia)
└── inne                    7 MB

PRZEKROCZONE LIMITY:
├── Cached Egress: 6,076 / 5 GB (122%) ← GŁÓWNY PROBLEM
├── Database Size: 379 / 500 MB (76%)
└── Storage Size: 751 / 1000 MB (75%)
```

Cached Egress jest przekroczony (122%) -- to dlatego projekt jest zablokowany. Auto-publish cron co minutę generuje zapytania HTTP, które zwracają 402 i liczą się jako egress. Zmiana na co 2 minuty zmniejszy egress o ~50%.

### Plan naprawy (4 kroki)

**1. TRUNCATE zamiast VACUUM FULL (odzyskanie ~308 MB z DB)**

`TRUNCATE` działa w transakcji i natychmiast zwalnia miejsce. Użyjemy go na obu tabelach, bo:
- `net._http_response` -- 366 wierszy, same błędy 402, bezwartościowe
- `cron.job_run_details` -- logi cron, niepotrzebne historycznie

Musisz uruchomić w SQL Editorze Supabase:
```sql
TRUNCATE cron.job_run_details;
TRUNCATE net._http_response;
```

**2. Zmiana auto-publish cron z 1 min na 2 min (redukcja egress ~50%)**

Migracja SQL: `cron.unschedule` starego joba i `cron.schedule` nowego z `*/2 * * * *`.

**3. Skrócenie retencji logów do 24h**

Aktualizacja istniejących cronów czyszczących:
- `cron.job_run_details`: z 7 dni na 24h
- `net._http_response`: już 24h (OK)

**4. Usunięcie osieroconych plików storage (~184 MB)**

Po odblokowaniu projektu -- wywołanie `cleanup-unused-images` i `cleanup-temp-videos` Edge Functions, które usuną 81 osieroconych plików + 4 temp pliki.

### Oczekiwany efekt

```text
Database: 347 MB → ~39 MB
Storage: 291 MB → ~107 MB
Egress: spadnie o ~50% dzięki rzadszemu cronowi
```

### Kolejność działań

1. **Ty** -- uruchom TRUNCATE w SQL Editorze (krok 1)
2. **Ja** -- stworzę migrację zmieniającą cron na co 2 minuty i retencję na 24h (kroki 2-3)
3. **Ja** -- po odblokowaniu wywołam cleanup Edge Functions (krok 4)

