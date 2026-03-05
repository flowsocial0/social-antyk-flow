

## Problem: Tymczasowe pliki wideo (temp-videos) nie są usuwane i zajmują 1.4 GB

### Diagnoza

Bucket `ObrazkiKsiazek` zajmuje **1805 MB**, z czego:
- **temp-videos/**: **169 plików = 1399 MB** (77% całego storage)
- **books/**: 637 plików = 69 MB

Pliki `temp-videos/` to tymczasowe wideo z Mega.nz, które powinny być usuwane po publikacji. Cleanup nie działa niezawodnie -- jeśli publikacja się nie powiedzie, retry się zawiesi, lub Edge Function timeout, pliki zostają na zawsze. Codziennie przybywa ~50-120 MB nowych temp plików, które nigdy nie są czyszczone.

### Rozwiązanie

Stworzymy **automatyczny cron job** (Edge Function + pg_cron), który co godzinę usuwa pliki `temp-videos/` starsze niż 2 godziny. Dodatkowo jednorazowo wyczyścimy istniejące 169 plików.

### Plan implementacji

1. **Nowa Edge Function `cleanup-temp-videos`** -- listuje pliki w `temp-videos/`, usuwa te starsze niż 2h (na podstawie timestampa w nazwie pliku lub `created_at` z `storage.objects`)

2. **Cron job w bazie** -- uruchamiany co godzinę via `pg_cron` + `pg_net` (lub via `supabase/config.toml` schedule jeśli dostępny), wywołuje `cleanup-temp-videos`

3. **Jednorazowe czyszczenie** -- przy pierwszym uruchomieniu funkcja usunie wszystkie 169 zalegających plików (1.4 GB)

4. **Ulepszenie istniejącego cleanup** -- zaktualizować `cleanup-unused-images` żeby również czyściło `temp-videos/`

### Szczegóły techniczne

**Edge Function `cleanup-temp-videos`:**
```typescript
// Listuje storage.objects WHERE bucket_id = 'ObrazkiKsiazek' AND name LIKE 'temp-videos/%'
// AND created_at < NOW() - INTERVAL '2 hours'
// Usuwa je w batchach po 100
```

**Cron (migracja SQL):**
```sql
SELECT cron.schedule(
  'cleanup-temp-videos',
  '0 * * * *',  -- co godzinę
  $$SELECT net.http_post(...)$$
);
```

**Oczekiwany efekt:** Natychmiastowe odzyskanie ~1.4 GB, a w przyszłości pliki temp nigdy nie będą istnieć dłużej niż 2h.

