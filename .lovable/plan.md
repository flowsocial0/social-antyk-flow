## Reset tokenów TikTok (wymuszenie ponownej autoryzacji)

Aby ponownie zobaczyć ekran zgody TikToka (zamiast cichego logowania), trzeba:

### 1. Usunąć tokeny z bazy

Wyczyścić rekordy w tabeli `tiktok_oauth_tokens` dla Twojego użytkownika (wszystkie konta lub konkretne wybrane). Można:

- **Wariant A** (wszystkie konta TikTok): `DELETE FROM tiktok_oauth_tokens WHERE user_id = '<twoj_uuid>'`
- **Wariant B** (jedno konkretne konto): `DELETE FROM tiktok_oauth_tokens WHERE id = '<token_id>'`

### 2. Wymusić ekran zgody w OAuth start

W `supabase/functions/tiktok-oauth-start/index.ts` dodać do URL autoryzacyjnego parametr `prompt=consent` (lub odpowiednik `force_authentication=1` używany przez TikTok), żeby nawet po reset tokenów TikTok pokazał pełny ekran wyboru uprawnień zamiast cichej zgody, jeśli przeglądarka pamięta sesję.

### 3. Wyczyścić sesję TikToka w przeglądarce (po Twojej stronie — instrukcja)

Po usunięciu tokenów po naszej stronie, jeśli TikTok nadal automatycznie potwierdza autoryzację:

- Wyloguj się z tiktok.com w przeglądarce, na której łączysz konto, **albo**
- Użyj trybu incognito do ponownej autoryzacji w Social Auto Flow.

### Pytania przed wykonaniem

Potrzebuję wiedzieć:

1. Czy zresetować **wszystkie** Twoje konta TikTok, czy konkretne (np. tylko `socialflow5` / `Glowaccy Solutions`)?
2. Czy dodać `prompt=consent` na stałe do flow OAuth (przyda się też w przyszłości przy podobnych sytuacjach)?

Po Twojej odpowiedzi wykonam DELETE w bazie i (opcjonalnie) zaktualizuję `tiktok-oauth-start`.

&nbsp;

Odpowiedź użytkownika:

Dodaj opcje, która na żądanie usunie tokeny z wybranego konta w dowolnym socialu