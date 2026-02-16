

## Naprawa testu połączenia Pinterest

### Problem
Token OAuth uzyskany przez produkcyjne API Pinterest (`api.pinterest.com`) nie dziala na sandbox API (`api-sandbox.pinterest.com`). To dwa oddzielne srodowiska - sandbox nie akceptuje tokenow produkcyjnych.

Callback OAuth poprawnie pobiera dane uzytkownika z produkcyjnego API, ale test polaczenia wysyla ten sam token do sandboxa, ktory zwraca 401 "Authentication failed".

Dodatkowo w tabeli `pinterest_oauth_tokens` brakuje unique constraint na `user_id`, co powoduje bledy przy upsert w callbacku.

### Rozwiazanie

#### 1. Podwojne endpointy w Edge Function `publish-to-pinterest`

- **Test polaczenia** (odczyt) --> uzywamy produkcyjne API `api.pinterest.com/v5/user_account` (token produkcyjny dziala tu poprawnie)
- **Tworzenie pinow** (zapis) --> uzywamy sandbox `api-sandbox.pinterest.com/v5/pins` (wymagane dla Trial access)

#### 2. Dodanie unique constraint na `user_id`

Migracja SQL dodajaca unique constraint, zeby upsert w callbacku dzialal poprawnie i nie tworzyl duplikatow.

### Szczegoly techniczne

**Plik: `supabase/functions/publish-to-pinterest/index.ts`**
- Zdefiniowac dwa endpointy: `PINTEREST_API_READ = 'https://api.pinterest.com'` i `PINTEREST_API_WRITE = 'https://api-sandbox.pinterest.com'`
- Test polaczenia (linia 58): uzyc `PINTEREST_API_READ`
- Tworzenie pinow (linia 153): uzyc `PINTEREST_API_WRITE`
- Dodac komentarz TODO ze po pelnym dostepie oba maja wskazywac na `api.pinterest.com`

**Migracja bazy danych:**
```text
-- Usun duplikaty jesli istnieja (zostawiamy najnowszy)
DELETE FROM pinterest_oauth_tokens a
USING pinterest_oauth_tokens b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- Dodaj unique constraint
ALTER TABLE pinterest_oauth_tokens
ADD CONSTRAINT pinterest_oauth_tokens_user_id_key UNIQUE (user_id);
```

**Wdrozenie:** Redeploy Edge Function `publish-to-pinterest`.

