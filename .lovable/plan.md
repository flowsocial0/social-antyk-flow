

# Plan: Dodanie Snapchat, Discord, Tumblr i Google Business Profile

## Podsumowanie

Dodajemy 4 nowe platformy do systemu automatycznego publikowania. Kazda wymaga: tabeli w bazie danych, edge functions, integracji z frontendem.

---

## Platforma 1: Discord (Webhooks - najprostsza)

**Typ:** Webhook URL (jak Telegram - formularz, bez OAuth)

**API:** POST na webhook URL z JSON body (tekst + embeds z obrazem)

**Elementy do utworzenia:**
- Tabela DB: `discord_tokens` (user_id, webhook_url, channel_name, account_name, is_default)
- Edge Function: `publish-to-discord` (POST na webhook URL)
- Frontend: `DiscordSetupDialog.tsx` (formularz: Webhook URL + nazwa)
- Brak oauth-start/callback - konfiguracja przez formularz

**Wymagane sekrety:** Brak (webhook URL per-user w DB)

---

## Platforma 2: Tumblr (OAuth 2.0)

**Typ:** OAuth 2.0

**API:**
- Auth: `https://www.tumblr.com/oauth2/authorize`
- Token: `https://api.tumblr.com/v2/oauth2/token`
- Publish: `POST https://api.tumblr.com/v2/blog/{blog}/posts` (Neue Post Format)
- Scopes: `basic`, `write`, `offline_access`

**Elementy do utworzenia:**
- Tabela DB: `tumblr_oauth_tokens` (user_id, access_token, refresh_token, expires_at, blog_name, username)
- Edge Functions: `tumblr-oauth-start`, `tumblr-oauth-callback`, `publish-to-tumblr`
- Frontend: `TumblrCallback.tsx` + integracja SocialAccounts

**Wymagane sekrety:** TUMBLR_API_KEY, TUMBLR_API_SECRET

---

## Platforma 3: Snapchat (OAuth 2.0 - Business API)

**Typ:** OAuth 2.0 (Snap Business)

**API:**
- Auth: `https://accounts.snapchat.com/login/oauth2/authorize`
- Token: `https://accounts.snapchat.com/login/oauth2/access_token`
- Publish: `POST https://businessapi.snapchat.com/v1/public_profiles/{id}/stories` (Stories/Spotlight)
- Scopes: `snapchat-marketing-api`, `snapchat-profile-api`

**Uwagi:** Wymaga konta Snap Business. Stories znikaja po 24h. Ograniczone mozliwosci.

**Elementy do utworzenia:**
- Tabela DB: `snapchat_oauth_tokens` (user_id, access_token, refresh_token, expires_at, display_name, organization_id)
- Edge Functions: `snapchat-oauth-start`, `snapchat-oauth-callback`, `publish-to-snapchat`
- Frontend: `SnapchatCallback.tsx` + integracja SocialAccounts

**Wymagane sekrety:** SNAPCHAT_CLIENT_ID, SNAPCHAT_CLIENT_SECRET

---

## Platforma 4: Google Business Profile (OAuth 2.0 - Google)

**Typ:** OAuth 2.0 (Google)

**API:**
- Auth: Google OAuth 2.0 (accounts.google.com)
- Publish: `POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts`
- Scopes: `https://www.googleapis.com/auth/business.manage`

**Uwagi:** Wymaga firmy w Google z lokalizacja. Posty widoczne w Google Maps i wyszukiwarce.

**Elementy do utworzenia:**
- Tabela DB: `google_business_tokens` (user_id, access_token, refresh_token, expires_at, account_id, location_id, business_name)
- Edge Functions: `google-business-oauth-start`, `google-business-oauth-callback`, `publish-to-google-business`
- Frontend: `GoogleBusinessCallback.tsx` + integracja SocialAccounts

**Wymagane sekrety:** GOOGLE_BUSINESS_CLIENT_ID, GOOGLE_BUSINESS_CLIENT_SECRET

---

## Wspolne zmiany (dla wszystkich 4 platform)

### 1. Migracja bazy danych
- 4 nowe tabele z RLS policies (user moze CRUD tylko swoje tokeny)

### 2. Konfiguracja platform (`src/config/platforms.ts`)
- Dodanie 4 nowych PlatformId: `discord`, `tumblr`, `snapchat`, `google_business`
- Status: `active`

### 3. Frontend - SocialAccounts.tsx
- Dodanie 4 nowych platform do PlatformAccounts interface
- Nowe funkcje connect (connectDiscord jako dialog, reszta jako OAuth)
- Dodanie do platformConfig array i tableMap

### 4. Frontend - AccountSelector.tsx + CampaignDetails.tsx
- Dodanie zapytan do nowych tabel
- Mapowanie na AccountOption

### 5. Frontend - Routing (App.tsx)
- Nowe callback pages: `/oauth/tumblr/callback`, `/oauth/snapchat/callback`, `/oauth/google-business/callback`

### 6. auto-publish-books
- Dodanie 4 nowych case'ow

### 7. OtherPlatformsContent.tsx
- Aktualizacja listy platform

### 8. PlatformConnectionStatus.tsx
- Dodanie mapowania nowych tabel

---

## Nowe pliki do utworzenia

| Plik | Opis |
|------|------|
| supabase/functions/publish-to-discord/index.ts | Publikacja przez webhook |
| supabase/functions/tumblr-oauth-start/index.ts | OAuth start |
| supabase/functions/tumblr-oauth-callback/index.ts | OAuth callback |
| supabase/functions/publish-to-tumblr/index.ts | Publikacja postow |
| supabase/functions/snapchat-oauth-start/index.ts | OAuth start |
| supabase/functions/snapchat-oauth-callback/index.ts | OAuth callback |
| supabase/functions/publish-to-snapchat/index.ts | Publikacja Stories |
| supabase/functions/google-business-oauth-start/index.ts | OAuth start |
| supabase/functions/google-business-oauth-callback/index.ts | OAuth callback |
| supabase/functions/publish-to-google-business/index.ts | Publikacja postow |
| src/components/social/DiscordSetupDialog.tsx | Dialog konfiguracji webhook |
| src/pages/TumblrCallback.tsx | Callback page |
| src/pages/SnapchatCallback.tsx | Callback page |
| src/pages/GoogleBusinessCallback.tsx | Callback page |

---

## Pliki do edycji

| Plik | Zmiana |
|------|--------|
| src/config/platforms.ts | +4 platformy (discord, tumblr, snapchat, google_business) |
| src/pages/SocialAccounts.tsx | +4 platformy w accounts, connect functions, platformConfig |
| src/components/campaigns/AccountSelector.tsx | +4 zapytania do nowych tabel |
| src/pages/CampaignDetails.tsx | +4 bloki ladowania kont |
| src/App.tsx | +4 callback routes |
| src/components/platforms/PlatformConnectionStatus.tsx | +4 mapowania tabel |
| src/components/dashboard/platforms/OtherPlatformsContent.tsx | Aktualizacja listy |
| supabase/functions/auto-publish-books/index.ts | +4 case'y |
| supabase/config.toml | +10 nowych funkcji z verify_jwt = false |

---

## Wymagane sekrety (do dodania pozniej)

| Sekret | Platforma | Skad |
|--------|-----------|------|
| TUMBLR_API_KEY | Tumblr | tumblr.com/oauth/apps |
| TUMBLR_API_SECRET | Tumblr | tumblr.com/oauth/apps |
| SNAPCHAT_CLIENT_ID | Snapchat | business.snapchat.com |
| SNAPCHAT_CLIENT_SECRET | Snapchat | business.snapchat.com |
| GOOGLE_BUSINESS_CLIENT_ID | Google Business | console.cloud.google.com |
| GOOGLE_BUSINESS_CLIENT_SECRET | Google Business | console.cloud.google.com |

Discord nie wymaga sekretow - webhook URL per-user.

---

## Sugerowana kolejnosc implementacji

1. **Discord** - najprostszy (webhook, brak OAuth, wzorowany na Telegram)
2. **Tumblr** - standardowy OAuth 2.0
3. **Snapchat** - OAuth 2.0, bardziej zlozony (Business API)
4. **Google Business** - OAuth 2.0 Google, wymaga lokalizacji

Proponuje zrobic wszystko w 2 partiach: Discord + Tumblr, potem Snapchat + Google Business.

