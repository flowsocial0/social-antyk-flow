

## Analiza zużycia zasobów Supabase

### Obecny stan

```text
STORAGE (bucket ObrazkiKsiazek): 419 MB
├── videos/           168 MB  (23 pliki, 14 z Mega duplikatem = 121 MB do usunięcia)
├── 644dcc40.../      121 MB  (54 pliki, 0 referencji = całość do usunięcia)
├── ac74eee0.../       41 MB  (44 pliki, 0 referencji = całość do usunięcia)
├── books/             69 MB  (637 plików, używane)
├── temp-videos/       14 MB  (cleanup działa)
└── inne                6 MB

BAZA DANYCH: 334 MB
├── net._http_response   181 MB  (logi pg_net, ~361 wierszy ale duże)
├── cron.job_run_details 114 MB  (169K wierszy od 5 miesięcy!)
└── dane aplikacji        39 MB

RAZEM: ~753 MB (Supabase liczy z WAL/indeksami, stąd 1.7 GB)
```

Supabase odświeża metryki co ~24h dla billingu, ale dashboard pokazuje dane z opóźnieniem kilku godzin. Po cleanup efekt będzie widoczny następnego dnia.

### Źródła problemu

1. **cron.job_run_details** -- 114 MB, 169K wierszy. Auto-publish cron co minutę od 5 miesięcy, nigdy nieczyszczone.
2. **Osierocone pliki w folderach user-id** -- 162 MB plików wideo, które nie są referencjonowane przez żadną książkę.
3. **Duplikaty wideo z Mega** -- 121 MB plików w `videos/`, które mają backup na Mega.nz. Można usunąć kopie ze storage i zostawić Mega URL.

### Plan optymalizacji

**1. Czyszczenie cron.job_run_details (oszczędność ~114 MB)**
- Migracja SQL: usunięcie wpisów starszych niż 7 dni
- Dodanie crona, który co dzień czyści stare wpisy (zachowuje ostatnie 7 dni)

**2. Usunięcie osieroconych plików storage (oszczędność ~162 MB)**
- Rozszerzenie Edge Function `cleanup-unused-images` o skanowanie WSZYSTKICH folderów w buckecie (nie tylko `books/` i `temp-videos/`)
- Jednorazowe wywołanie usunie 98 osieroconych plików z folderów user-id

**3. Deduplikacja wideo z Mega (oszczędność ~121 MB)**
- Dla 14 książek, które mają `video_storage_path` wskazujący na `videos/` ORAZ `video_url` z Mega.nz -- wyczyścić `video_storage_path` i usunąć plik ze storage
- System i tak pobiera wideo z Mega podczas publikacji

**4. Czyszczenie net._http_response (oszczędność ~181 MB)**
- Migracja SQL: dodanie crona czyszczącego odpowiedzi HTTP starsze niż 24h

### Oczekiwany efekt

```text
Przed:  ~1.7 GB (raport Supabase)
Po:     ~400-500 MB
Oszczędność: ~578 MB jednorazowo + zapobieganie przyszłemu wzrostowi
```

### Szczegóły techniczne

- Migracja SQL z `DELETE FROM cron.job_run_details WHERE start_time < NOW() - INTERVAL '7 days'`
- Migracja SQL z `DELETE FROM net._http_response WHERE created < NOW() - INTERVAL '1 day'`
- Cron jobs dla obu tabel (raz dziennie)
- Aktualizacja `cleanup-unused-images` -- pełne skanowanie bucketu vs referencje w `books.storage_path` i `books.video_storage_path`
- UPDATE na 14 książkach: `SET video_storage_path = NULL WHERE video_url LIKE 'https://mega.nz/%'`

