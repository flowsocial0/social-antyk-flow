

## Aktualny stan po TRUNCATE

```text
DATABASE: 39 MB (OK - TRUNCATE zadziałał)
├── cron.job_run_details: 104 KB (4 wiersze)
├── net._http_response: 56 KB (0 wierszy)
└── dane aplikacji: ~39 MB

STORAGE: 291 MB
├── 644dcc40.../   118 MB (42 pliki, 0 referencji - OSIEROCONE)
├── books/          61 MB (598 plików - UŻYWANE)
├── videos/         39 MB (6 plików - WSZYSTKIE używane przez books)
├── ac74eee0.../    35 MB (35 plików, 0 referencji - OSIEROCONE)
├── temp-videos/    31 MB (4 pliki - DO USUNIĘCIA)
├── 662824bf.../     7 MB (3 pliki - prawdopodobnie osierocone)
├── 23012587_1.jpg   0 MB (1 plik - OSIEROCONY)
└── RAZEM:         291 MB

CRONY AKTYWNE:
├── cleanup-http-response-daily (24h retencja) ✅
├── cleanup-cron-job-details-daily (24h retencja) ✅
├── auto-publish - WYŁĄCZONY ❌
└── cleanup-temp-videos - WYŁĄCZONY ❌

LIMITY FREE PLAN:
├── Database: 500 MB (39 MB = 8%) ✅
├── Storage: 1 GB (291 MB = 29%) ✅
├── Cached Egress: 5 GB/mies ← był przekroczony (122%)
├── Edge Function Invocations: 500K/mies
└── Edge Function Runtime: brak limitu na free
```

## Kluczowe ustalenia

1. **Folder `videos/`** -- 6 plików, 39 MB -- WSZYSTKIE referencjonowane w `books`. Nie usuwać.
2. **Osierocone foldery** -- 644dcc40 (118 MB), ac74eee0 (35 MB), 662824bf (7 MB) -- razem 160 MB do usunięcia.
3. **temp-videos/** -- 31 MB, 4 pliki do usunięcia.
4. **Crony auto-publish i cleanup-temp-videos** -- wyłączone, trzeba przywrócić.
5. **Egress** -- główna przyczyna blokady. Resetuje się co miesiąc. Cron co 2 min zamiast 1 min = ~21,600 wywołań/mies zamiast 43,200.

## Plan implementacji

### 1. Wywołanie cleanup Edge Functions (usunięcie ~191 MB)

Wywołam `cleanup-unused-images` i `cleanup-temp-videos` przez API -- usuną osierocone pliki z folderów 644dcc40, ac74eee0, 662824bf, temp-videos i plik 23012587_1.jpg.

Oczekiwany storage po cleanup: ~100 MB (books 61 + videos 39).

### 2. Przywrócenie cronów (INSERT via SQL)

Dwa nowe cron joby (nie migracja -- zawierają URL i klucz):
- `auto-publish-every-2-minutes`: `*/2 * * * *` -- wywołanie `auto-publish-books`
- `cleanup-temp-videos-hourly`: `0 * * * *` -- wywołanie `cleanup-temp-videos`

### 3. Nowa Edge Function `admin-resource-monitor`

Zwraca aktualny stan zasobów:
- Rozmiar bazy danych (`pg_database_size`)
- Rozmiar storage (z `storage.objects` -- sum metadata->size per folder)
- Rozmiar tabel logów (cron.job_run_details, net._http_response)
- Liczba aktywnych cron jobów
- Liczba osieroconych plików (pliki bez referencji w books)

### 4. Komponent `ResourceMonitor` w panelu admin

Nowy komponent `src/components/admin/ResourceMonitor.tsx` dodany do `Admin.tsx`:

- **Karty z postępem** dla każdego limitu:
  - Database: X / 500 MB (progress bar, kolor zielony/żółty/czerwony)
  - Storage: X / 1000 MB
  - Osierocone pliki: liczba + rozmiar
  - Logi cron: rozmiar + wiersze
  - Logi HTTP: rozmiar + wiersze

- **Przyciski akcji**:
  - "Wyczyść osierocone pliki" -- wywołuje `cleanup-unused-images`
  - "Wyczyść temp-videos" -- wywołuje `cleanup-temp-videos`
  - "Odśwież dane" -- ponowne pobranie statystyk

- **Status cronów**: lista aktywnych cron jobów z ich harmonogramem

### Szczegóły techniczne

**Edge Function `admin-resource-monitor`:**
- Wymaga autoryzacji (sprawdzenie `has_role` przez service_role client)
- Zapytania SQL: `pg_database_size`, `pg_total_relation_size`, agregacja `storage.objects`
- Porównanie plików storage vs referencje w `books` (dry-run cleanup)

**Komponent `ResourceMonitor`:**
- Wywołuje `supabase.functions.invoke('admin-resource-monitor')`
- Progress bary z kolorami: zielony <60%, żółty 60-80%, czerwony >80%
- Przyciski cleanup z potwierdzeniem i loadingiem

**Limity free planu (hardcoded w komponencie):**
- Database: 500 MB
- Storage: 1000 MB (1 GB)
- Egress: 5 GB (nie da się zmierzyć z poziomu SQL -- informacja tekstowa)

