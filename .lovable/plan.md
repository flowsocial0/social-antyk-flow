

## Naprawa publikacji Pinterest - produkcyjne API dla wszystkich operacji

### Co robimy
Zmieniamy endpoint publikacji pinow z Sandbox na Production API. Token OAuth produkcyjny dziala na produkcyjnym API zarowno do odczytu jak i zapisu. Trial access oznacza jedynie ze piny sa widoczne tylko dla wlasciciela konta - ale sa tworzone poprawnie.

### Dlaczego to zadziala
- Test polaczenia juz przechodzi na produkcyjnym API - token jest wazny
- Pinterest Trial access pozwala na tworzenie pinow przez produkcyjne API
- Sandbox wymaga oddzielnych tokenow (generowanych recznie w Developer Console) - dlatego produkcyjny token tam nie dziala

### Ograniczenie Trial access
Piny utworzone w trybie Trial beda widoczne **tylko dla Ciebie**. Po przejsciu review na Pintereście beda publiczne. Funkcjonalnosc jest identyczna.

### Szczegoly techniczne

**Plik: `supabase/functions/publish-to-pinterest/index.ts`**

Zmiana linii 4-7 - zastapienie dwoch stalych jedna:

```text
// Pinterest API - production endpoint for all operations
// Trial access: pins are created but visible only to app owner
// After full review approval, pins become public automatically
const PINTEREST_API = 'https://api.pinterest.com';
```

- Linia 60: `${PINTEREST_API}/v5/user_account` (test polaczenia - bez zmian logicznych)
- Linia 155: `${PINTEREST_API}/v5/pins` (publikacja - zmiana z sandbox na produkcje)

Redeploy Edge Function `publish-to-pinterest`.

