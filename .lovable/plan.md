

## Pinterest - ostateczne rozwiazanie

### Sytuacja (potwierdzona dokumentacja Pinterest)

Pinterest ma 3 poziomy dostepu:
- **Trial** (obecny): OAuth dziala, ale token produkcyjny moze TYLKO czytac dane konta. Tworzenie pinow na produkcji jest ZABLOKOWANE. Sandbox wymaga oddzielnego tokena generowanego recznie.
- **Standard** (po review): OAuth dziala w pelni, produkcyjne API bez ograniczen.
- **Sandbox**: Oddzielne srodowisko z recznym tokenem (nie OAuth), waznym 30 dni.

### Dwie sciezki do wyboru

---

### Sciezka A: Tymczasowe testowanie przez Sandbox

Pozwala przetestowac publikowanie pinow JUZ TERAZ, ale wymaga recznego kopiowania tokena co 30 dni.

**Co musisz zrobic reczenie:**
1. Wejdz na https://developers.pinterest.com/apps/
2. Kliknij "Manage" na swojej aplikacji
3. Zakladka "Configure" - sekcja "Generate Access Token"
4. Wybierz "Sandbox token" i kliknij "Generate token"
5. Skopiuj wygenerowany token

**Zmiany w kodzie:**
1. `supabase/functions/publish-to-pinterest/index.ts` - zmiana endpointu na `https://api-sandbox.pinterest.com` dla tworzenia pinow
2. Test polaczenia - zostawic na `https://api.pinterest.com` (bo obecny token OAuth tam dziala) LUB tez zmienic na sandbox (jesli uzywamy sandbox tokena)
3. Dodac w UI lub instrukcji sposob na reczne wklejenie sandbox tokena do bazy

**Wada:** Token wygasa po 30 dniach, trzeba recznie generowac nowy.

---

### Sciezka B: Zgloszenie review na Standard access (zalecane)

Po akceptacji caly obecny kod (produkcyjne API + OAuth) bedzie dzialal bez zmian.

**Co trzeba przygotowac do review:**

Pinterest wymaga pokazania dzialajacego flow. Mozesz:
1. Nagrac krotki film pokazujacy:
   - Uzytkownik loguje sie do Twojej aplikacji
   - Laczy konto Pinterest przez OAuth (to juz dziala)
   - Wybiera ksiazke i klika "Publikuj na Pinterest"
   - Pokazac ze pin jest tworzony (mozesz uzyc sandbox tokena do nagrania tego demo)
2. Opisac use case: "Automatyczna publikacja produktow (ksiazek) na Pinterest z poziomu aplikacji do zarzadzania social media"
3. Podac redirect URI i scopes jakich uzywasz

**Jak zlozyc review:**
1. Wejdz na https://developers.pinterest.com/apps/
2. Wybierz swoja aplikacje
3. Kliknij "Request Standard access" lub "Submit for review"
4. Wypelnij formularz z opisem i linkiem do demo/filmu

**Czas oczekiwania:** Zazwyczaj kilka dni roboczych.

---

### Rekomendacja

Najlepiej zrobic OBE sciezki rownolegle:
1. Wygenerowac sandbox token i przetestowac publikowanie (Sciezka A)
2. Nagrac demo z dzialajacym sandbox i zlozyc review (Sciezka B)
3. Po akceptacji review - zmienic endpoint z powrotem na produkcje i usunac reczny token

### Szczegoly techniczne zmian (dla Sciezki A)

**Plik: `supabase/functions/publish-to-pinterest/index.ts`**

Podwojne endpointy:
```text
// Production API for connection test (OAuth token works for reads)
const PINTEREST_API_READ = 'https://api.pinterest.com';
// Sandbox API for pin creation (requires sandbox token)
const PINTEREST_API_WRITE = 'https://api-sandbox.pinterest.com';
```

Test polaczenia (linia ~58): uzywa `PINTEREST_API_READ`
Tworzenie pinow (linia ~153): uzywa `PINTEREST_API_WRITE`

Dodac logike: jesli token jest sandbox (do rozpoznania np. po fladze w bazie), uzywac sandbox endpointu wszedzie. Jesli token jest produkcyjny (OAuth), uzywac produkcyjnego do odczytu.

**Dodatkowe pole w tabeli `pinterest_oauth_tokens`:**
Nowa kolumna `is_sandbox` (boolean, default false) - zeby odroznic tokeny sandbox od produkcyjnych.

Gdy `is_sandbox = true`:
- Test polaczenia uzywa `api-sandbox.pinterest.com`
- Publikacja uzywa `api-sandbox.pinterest.com`

Gdy `is_sandbox = false` (token OAuth):
- Test polaczenia uzywa `api.pinterest.com`
- Publikacja uzywa `api.pinterest.com` (zadziala dopiero po Standard access)

**Redeploy:** Edge Function `publish-to-pinterest`

