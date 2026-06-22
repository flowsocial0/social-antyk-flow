## Stan

Użytkownik potwierdza, że ma już Production credentials z TikTok Portal. Pora zaktualizować sekrety i zredeployować edge functions.

## Kroki

1. **Aktualizacja sekretów** (przez `secrets--update_secret`):
   - `TIKTOK_CLIENT_KEY` → wartość Production
   - `TIKTOK_CLIENT_SECRET` → wartość Production
   
   Otworzy się bezpieczne okno do wklejenia wartości — nie wpisujesz ich w czacie.

2. **Redeploy edge functions** używających tych sekretów:
   - `tiktok-oauth-start`
   - `tiktok-oauth-callback`
   - `publish-to-tiktok`
   - `tiktok-oauth-revoke`

3. **Bonus UI** — w `src/pages/TikTokCallback.tsx` dodam wykrycie `error=non_sandbox_target` w query params i pokażę po polsku przyjazny toast zamiast surowego komunikatu z TikToka:
   > "To konto TikTok nie ma dostępu do aplikacji. Skontaktuj się z administratorem."

## Test po zmianie

1. Rozłącz aktualne (testowe) konto TikTok w `/accounts`.
2. Połącz **konto produkcyjne** (to, na którym wcześniej leciał `non_sandbox_target`).
3. OAuth powinien przejść do końca, wpis utworzony w `tiktok_oauth_tokens`.
4. Konto testowe nadal się łączy bez problemu.

## Out of scope

- Logika OAuth w funkcjach edge — bez zmian.
- `src/config/platforms.ts` — TikTok już aktywny.
- Bazy danych — bez zmian.
