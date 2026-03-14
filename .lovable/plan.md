

## Problem: Storage UI nie ładuje się, ale SQL Editor działa

Dashboard Storage jest zablokowany przez quota, więc nie możesz ręcznie usunąć folderów. Ale skoro SQL Editor działa, możemy usunąć osierocone pliki bezpośrednio przez SQL -- tabela `storage.objects` zawiera wszystkie pliki.

### Plan: Usunięcie osieroconych plików przez SQL

Uruchom w **SQL Editorze** Supabase następujące zapytania (jedno po drugim):

**Krok 1: Usuń folder `644dcc40-a8ec-4125-b340-0b3a6e068683` (~118 MB, 42 pliki)**
```sql
DELETE FROM storage.objects 
WHERE bucket_id = 'ObrazkiKsiazek' 
AND name LIKE '644dcc40-a8ec-4125-b340-0b3a6e068683/%';
```

**Krok 2: Usuń folder `ac74eee0-0b37-49cb-8c66-3185c92384ea` (~35 MB, 35 plików)**
```sql
DELETE FROM storage.objects 
WHERE bucket_id = 'ObrazkiKsiazek' 
AND name LIKE 'ac74eee0-0b37-49cb-8c66-3185c92384ea/%';
```

**Krok 3: Usuń folder `temp-videos` (~31 MB, 4 pliki)**
```sql
DELETE FROM storage.objects 
WHERE bucket_id = 'ObrazkiKsiazek' 
AND name LIKE 'temp-videos/%';
```

**Krok 4: Usuń osierocony plik w root (~21 KB)**
```sql
DELETE FROM storage.objects 
WHERE bucket_id = 'ObrazkiKsiazek' 
AND name = '23012587_1.jpg';
```

### Oczekiwany efekt

```text
Storage: 291 MB → ~107 MB (books/ 61 MB + videos/ 39 MB + 662824bf/ 7 MB)
```

**Uwaga**: Usunięcie z `storage.objects` przez SQL usuwa metadane. Fizyczne pliki w S3 zostaną usunięte przez wewnętrzny garbage collector Supabase (zwykle w ciągu kilku minut do godziny). Metryki billingu odświeżą się w ciągu 24h.

### Po odblokowaniu

Gdy Supabase zdejmie blokadę, stworzę migrację przywracającą crony:
- `auto-publish-books` co 2 minuty
- `cleanup-temp-videos` co godzinę

