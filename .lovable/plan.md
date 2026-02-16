

## Naprawa integracji Reddit

### Co trzeba zrobic

1. **Dodac sekrety** `REDDIT_CLIENT_ID` i `REDDIT_CLIENT_SECRET` do Supabase
2. **Naprawic callback** -- upsert zamiast insert, redirect na Lovable preview
3. **Dodac refresh tokena** w publish-to-reddit (tokeny wygasaja po 1h)
4. **Redeploy** obu Edge Functions

---

### Jak uzyskac Reddit API credentials

1. Wejdz na **https://www.reddit.com/prefs/apps**
2. Kliknij **"create another app..."** (na dole strony)
3. Wypelnij formularz:
   - **name**: SocialAutoFlow (lub dowolna nazwa)
   - **typ**: wybierz **"web app"**
   - **description**: Book promotion tool
   - **about url**: `https://socialautoflow.pl`
   - **redirect uri**: `https://dmrfbokchkxjzslfzeps.supabase.co/functions/v1/reddit-oauth-callback`
4. Kliknij **"create app"**
5. Po utworzeniu zobaczysz:
   - **Client ID** -- krotki ciag znakow pod nazwa aplikacji (np. `a1b2c3d4e5`)
   - **Client Secret** -- widoczny obok etykiety "secret"

Te dwie wartosci to `REDDIT_CLIENT_ID` i `REDDIT_CLIENT_SECRET` ktore dodam do Supabase Secrets.

---

### Zmiany techniczne

#### Plik: `supabase/functions/reddit-oauth-callback/index.ts`
- Redirect URL zostaje na Lovable preview (bez zmian)
- Redirect po sukcesie: `/platforms/reddit?connected=true&platform=reddit` (zamiast `/settings/social-accounts`)
- Zamiana `insert` na `upsert` z `onConflict: 'user_id'` -- zapobiega duplikatom tokenow

#### Plik: `supabase/functions/publish-to-reddit/index.ts`
- Dodanie odczytu `REDDIT_CLIENT_ID` i `REDDIT_CLIENT_SECRET`
- Dodanie logiki auto-refresh przed publikacja:
  - Sprawdzenie `expires_at` kazdego tokena
  - Jesli wygasl i istnieje `refresh_token` -- wymiana na nowy `access_token` przez Reddit API
  - Aktualizacja tokena w bazie

#### Redeploy
- `reddit-oauth-callback`
- `publish-to-reddit`

