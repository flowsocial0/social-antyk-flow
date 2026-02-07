

# Plan polaczenia pozostalych platform spolecznosciowych

## Obecny stan

| Platforma | OAuth | Publish | Tabela DB | Status |
|-----------|-------|---------|-----------|--------|
| X (Twitter) | tak | tak | twitter_oauth1_tokens | Aktywna |
| Facebook | tak | tak | facebook_oauth_tokens | Aktywna |
| Instagram | tak | tak | instagram_oauth_tokens | Aktywna |
| YouTube | tak | tak | youtube_oauth_tokens | Aktywna |
| TikTok | tak | tak | tiktok_oauth_tokens | Aktywna |
| LinkedIn | tak | tak | linkedin_oauth_tokens | Aktywna |
| **Pinterest** | brak | brak | brak | Planowana |
| **Threads** | brak | brak | brak | Planowana |
| **Bluesky** | brak | brak | brak | Planowana |
| **Telegram** | brak | brak | brak | Planowana |
| **Reddit** | brak | brak | brak | Planowana |
| **Mastodon** | brak | brak | brak | Planowana |
| **Gab** | brak | brak | brak | Planowana |

## Pozostale platformy do polaczenia - 7 platform

Kazda platforma wymaga tych samych 5 elementow:
1. Tabela OAuth tokens w bazie danych
2. Edge Function: oauth-start (rozpoczecie logowania)
3. Edge Function: oauth-callback (obsluga powrotu)
4. Edge Function: publish-to-{platform} (publikowanie)
5. Frontend: callback page + integracja z SocialAccounts + auto-publish-books

---

## Platforma 1: Threads (Meta)

**Typ autentykacji:** OAuth 2.0 (Meta/Facebook) - dziala bardzo podobnie do Instagram

**Wymagane klucze API:** Te same co Facebook/Instagram (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET) - juz sa skonfigurowane!

**Uprawnienia (scopes):** `threads_basic`, `threads_content_publish`, `threads_manage_replies`

**API publikowania:**
- POST `https://graph.threads.net/v1.0/{user_id}/threads` - tworzenie kontenera mediow
- POST `https://graph.threads.net/v1.0/{user_id}/threads_publish` - publikowanie

**Typ mediow:** tekst + obraz (both)

**Zmiany:**

| Element | Opis |
|---------|------|
| Migracja DB | Tabela `threads_oauth_tokens` (user_id, threads_user_id, access_token, expires_at, username) |
| Edge: threads-oauth-start | Buduje URL OAuth Threads z odpowiednimi scopes |
| Edge: threads-oauth-callback | Wymienia code na token, zapisuje w DB |
| Edge: publish-to-threads | Tworzy kontener -> publikuje (2-krokowy proces jak Instagram) |
| Frontend: ThreadsCallback.tsx | Strona callback, zapis do DB |
| SocialAccounts.tsx | Dodanie sekcji Threads |
| auto-publish-books | Dodanie case 'threads' |
| platforms.ts | Zmiana statusu na 'active' |

---

## Platforma 2: Bluesky (AT Protocol)

**Typ autentykacji:** App Password (login + haslo aplikacyjne) - NIE OAuth! Bluesky uzywa DID + App Password zamiast tradycyjnego OAuth.

**Wymagane klucze API:** Brak globalnych - kazdy uzytkownik podaje swoje: handle (np. user.bsky.social) + App Password (generowane w ustawieniach Bluesky)

**API publikowania:**
- POST `https://bsky.social/xrpc/com.atproto.server.createSession` - logowanie
- POST `https://bsky.social/xrpc/com.atproto.repo.createRecord` - tworzenie posta
- POST `https://bsky.social/xrpc/com.atproto.repo.uploadBlob` - upload mediow

**Typ mediow:** tekst + obraz (both), max 300 znakow

**Zmiany:**

| Element | Opis |
|---------|------|
| Migracja DB | Tabela `bluesky_tokens` (user_id, handle, did, app_password, created_at) - przechowywanie App Password |
| Edge: publish-to-bluesky | createSession -> uploadBlob (jesli obraz) -> createRecord |
| Frontend: Dialog logowania | Formularz w SocialAccounts (handle + App Password) zamiast OAuth redirect |
| SocialAccounts.tsx | Dodanie sekcji Bluesky z formularzem |
| auto-publish-books | Dodanie case 'bluesky' |
| platforms.ts | Zmiana statusu na 'active' |

Uwaga: Bluesky nie wymaga oauth-start/callback - uzytkownik po prostu wpisuje handle i App Password w formularzu.

---

## Platforma 3: Telegram (Bot API)

**Typ autentykacji:** Bot Token - uzytkownik tworzy bota przez @BotFather i podaje token + chat_id kanalu/grupy

**Wymagane klucze API:** Brak globalnych - kazdy uzytkownik podaje: Bot Token + Chat ID (kanalu lub grupy)

**API publikowania:**
- POST `https://api.telegram.org/bot{token}/sendMessage` - tekst
- POST `https://api.telegram.org/bot{token}/sendPhoto` - obraz + tekst
- POST `https://api.telegram.org/bot{token}/sendVideo` - wideo + tekst

**Typ mediow:** tekst + obraz + wideo (both)

**Zmiany:**

| Element | Opis |
|---------|------|
| Migracja DB | Tabela `telegram_tokens` (user_id, bot_token, chat_id, channel_name, created_at) |
| Edge: publish-to-telegram | sendMessage/sendPhoto/sendVideo w zaleznosci od mediow |
| Frontend: Dialog konfiguracji | Formularz w SocialAccounts (Bot Token + Chat ID) |
| SocialAccounts.tsx | Dodanie sekcji Telegram z formularzem |
| auto-publish-books | Dodanie case 'telegram' |
| platforms.ts | Zmiana statusu na 'active' |

Uwaga: Telegram nie wymaga OAuth - uzytkownik konfiguruje bota i podaje dane w formularzu.

---

## Platforma 4: Pinterest

**Typ autentykacji:** OAuth 2.0

**Wymagane klucze API (nowe sekrety):**
- `PINTEREST_APP_ID` - z Pinterest Developer Portal
- `PINTEREST_APP_SECRET` - z Pinterest Developer Portal
- `PINTEREST_REDIRECT_URI` - callback URL

**Uprawnienia (scopes):** `boards:read`, `boards:write`, `pins:read`, `pins:write`

**API publikowania:**
- POST `https://api.pinterest.com/v5/pins` - tworzenie pina z obrazem (obraz WYMAGANY)

**Typ mediow:** image-only (Pinterest wymaga obrazu)

**Zmiany:**

| Element | Opis |
|---------|------|
| Sekrety | PINTEREST_APP_ID, PINTEREST_APP_SECRET, PINTEREST_REDIRECT_URI |
| Migracja DB | Tabela `pinterest_oauth_tokens` (user_id, access_token, refresh_token, expires_at, username) |
| Edge: pinterest-oauth-start | Buduje URL OAuth Pinterest |
| Edge: pinterest-oauth-callback | Wymienia code na token |
| Edge: publish-to-pinterest | POST /v5/pins z obrazem + tekstem |
| Frontend: PinterestCallback.tsx | Strona callback |
| SocialAccounts.tsx | Dodanie sekcji Pinterest |
| auto-publish-books | Dodanie case 'pinterest' |
| platforms.ts | Zmiana statusu na 'active' |

---

## Platforma 5: Reddit

**Typ autentykacji:** OAuth 2.0

**Wymagane klucze API (nowe sekrety):**
- `REDDIT_CLIENT_ID` - z Reddit App Preferences
- `REDDIT_CLIENT_SECRET` - z Reddit App Preferences
- `REDDIT_REDIRECT_URI` - callback URL

**Uprawnienia (scopes):** `submit`, `read`, `identity`

**API publikowania:**
- POST `https://oauth.reddit.com/api/submit` - tworzenie posta (self/link/image)

**Typ mediow:** tekst + obraz + link (both)

**Zmiany:**

| Element | Opis |
|---------|------|
| Sekrety | REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URI |
| Migracja DB | Tabela `reddit_oauth_tokens` (user_id, access_token, refresh_token, expires_at, username, default_subreddit) |
| Edge: reddit-oauth-start | Buduje URL OAuth Reddit |
| Edge: reddit-oauth-callback | Wymienia code na token |
| Edge: publish-to-reddit | POST /api/submit z tekstem/obrazem |
| Frontend: RedditCallback.tsx | Strona callback |
| SocialAccounts.tsx | Dodanie sekcji Reddit |
| auto-publish-books | Dodanie case 'reddit' |
| platforms.ts | Zmiana statusu na 'active' |

Uwaga: Reddit wymaga podania subreddita do publikacji - trzeba dodac pole "domyslny subreddit" w ustawieniach.

---

## Platforma 6: Mastodon

**Typ autentykacji:** OAuth 2.0 - ale kazdy serwer Mastodon ma INNY endpoint OAuth! Uzytkownik musi podac URL swojego serwera (np. mastodon.social, fosstodon.org).

**Wymagane klucze API:** Brak globalnych - aplikacja rejestruje sie dynamicznie na kazdym serwerze Mastodon (POST /api/v1/apps)

**API publikowania:**
- POST `https://{server}/api/v2/media` - upload mediow
- POST `https://{server}/api/v1/statuses` - tworzenie posta (status + media_ids)

**Typ mediow:** tekst + obraz + wideo (both), max 500 znakow

**Zmiany:**

| Element | Opis |
|---------|------|
| Migracja DB | Tabela `mastodon_tokens` (user_id, server_url, access_token, username, client_id, client_secret) |
| Edge: mastodon-oauth-start | Rejestracja aplikacji na serwerze + budowanie URL OAuth |
| Edge: mastodon-oauth-callback | Wymienia code na token |
| Edge: publish-to-mastodon | Upload media -> POST /api/v1/statuses |
| Frontend: Dialog serwera | Formularz z polem "URL serwera Mastodon" przed OAuth |
| Frontend: MastodonCallback.tsx | Strona callback |
| SocialAccounts.tsx | Dodanie sekcji Mastodon |
| auto-publish-books | Dodanie case 'mastodon' |
| platforms.ts | Zmiana statusu na 'active' |

---

## Platforma 7: Gab

**Typ autentykacji:** OAuth 2.0 - Gab uzywa API kompatybilnego z Mastodon (fork Mastodona)

**Wymagane klucze API:** Podobnie do Mastodon - dynamiczna rejestracja aplikacji lub stale klucze

**API publikowania:** To samo co Mastodon (te same endpointy), serwer: `gab.com`

**Zmiany:**

| Element | Opis |
|---------|------|
| Migracja DB | Tabela `gab_tokens` (user_id, access_token, username) |
| Edge: gab-oauth-start | Rejestracja na gab.com + OAuth URL |
| Edge: gab-oauth-callback | Wymienia code na token |
| Edge: publish-to-gab | POST /api/v1/statuses (ten sam format co Mastodon) |
| Frontend: GabCallback.tsx | Strona callback |
| SocialAccounts.tsx | Dodanie sekcji Gab |
| auto-publish-books | Dodanie case 'gab' |
| platforms.ts | Zmiana statusu na 'active' |

---

## Sugerowana kolejnosc implementacji

Ze wzgledu na zlozonosc i wspoldzielenie infrastruktury, proponuje implementowac w tej kolejnosci:

| Kolejnosc | Platforma | Uzasadnienie |
|-----------|-----------|--------------|
| 1 | **Threads** | Uzywa tych samych kluczy Meta co Facebook/Instagram - minimalna konfiguracja |
| 2 | **Telegram** | Najprostsze API (Bot Token) - brak OAuth, szybka implementacja |
| 3 | **Bluesky** | Proste API (App Password) - brak OAuth, rosnie w popularnosci |
| 4 | **Mastodon** | Standardowe OAuth + dynamiczna rejestracja |
| 5 | **Gab** | Fork Mastodon - wspoldzieli kod z Mastodon |
| 6 | **Pinterest** | Standardowe OAuth, wymaga nowych kluczy API |
| 7 | **Reddit** | Standardowe OAuth, wymaga nowych kluczy API + konfiguracja subreddita |

---

## Wspolne zmiany dla wszystkich platform

### Baza danych (1 migracja)
- 7 nowych tabel OAuth tokens
- RLS policies dla kazdej tabeli (user moze czytac/edytowac tylko swoje tokeny)

### Frontend
- `SocialAccounts.tsx` - dodanie 7 nowych sekcji polaczen
- `AccountSelector.tsx` - rozszerzenie o nowe platformy w kampaniach
- `CampaignDetails.tsx` - ladowanie kont nowych platform
- `PlatformConnectionStatus.tsx` - mapowanie nazw tabel
- `platforms.ts` - zmiana statusow na 'active'
- 7 nowych stron callback (lub formularzy dla Bluesky/Telegram)
- Routing w App.tsx - dodanie nowych tras

### Edge Functions
- Do 17 nowych Edge Functions (oauth-start, oauth-callback, publish-to-* per platforma)
- Telegram i Bluesky nie potrzebuja oauth-start/callback - to 4 mniej
- Lacznie: ~13 nowych Edge Functions

### auto-publish-books
- Dodanie 7 nowych case'ow w switch statement

---

## Sekcja techniczna

### Struktura tabel OAuth (wspolny wzorzec)

```text
{platform}_oauth_tokens / {platform}_tokens:
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  access_token TEXT NOT NULL
  refresh_token TEXT               -- jesli platforma wspiera refresh
  expires_at  TIMESTAMPTZ          -- jesli token wygasa
  username    TEXT                  -- nazwa uzytkownika/kanalu
  created_at  TIMESTAMPTZ DEFAULT now()
  updated_at  TIMESTAMPTZ DEFAULT now()
  
  + RLS: user moze SELECT/INSERT/UPDATE/DELETE tylko WHERE user_id = auth.uid()
```

### Wzorzec publish-to-{platform}

```text
1. Odczytaj tokeny uzytkownika z tabeli
2. Jesli campaignPostId -> pobierz tekst/obraz z campaign_posts
3. Jesli bookId -> pobierz tekst/obraz z ksiazki
4. Jesli tekst bezposredni -> uzyj go
5. Upload mediow (jesli sa)
6. Opublikuj post przez API platformy
7. Zapisz wynik w book_scheduled_content / campaign_posts
8. Zwroc { success: true/false, message: ... }
```

### Wymagane nowe sekrety Supabase

```text
Threads:     (brak - uzywa FACEBOOK_APP_ID / FACEBOOK_APP_SECRET)
Bluesky:     (brak - dane per-user w DB)
Telegram:    (brak - dane per-user w DB)
Pinterest:   PINTEREST_APP_ID, PINTEREST_APP_SECRET, PINTEREST_REDIRECT_URI
Reddit:      REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URI
Mastodon:    (brak - dynamiczna rejestracja na kazdym serwerze)
Gab:         (brak - dynamiczna rejestracja lub stale klucze)
```

### Szacowany czas implementacji

```text
Threads:    ~2 sesje (najprostsze - wspolne klucze Meta)
Telegram:   ~1 sesja (bardzo proste API)
Bluesky:    ~1 sesja (proste API)
Mastodon:   ~2 sesje (dynamiczna rejestracja)
Gab:        ~1 sesja (kopia Mastodon)
Pinterest:  ~2 sesje (nowe klucze + OAuth)
Reddit:     ~2 sesje (nowe klucze + subreddit config)
RAZEM:      ~11 sesji
```

Ze wzgledu na rozmiar, proponuje implementowac w partiach po 2-3 platformy na sesje. Zaczynamy od Threads + Telegram + Bluesky (najlatwiejsze, bez nowych kluczy API).

