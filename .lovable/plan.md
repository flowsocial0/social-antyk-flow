
# Pozostale zmiany do zrobienia

Wszystkie 7 platform (Threads, Telegram, Bluesky, Mastodon, Gab, Pinterest, Reddit) ma juz zaimplementowane:
- Tabele w bazie danych
- Edge Functions (oauth-start, oauth-callback, publish-to-*)
- Strony callback
- Integracja z SocialAccounts.tsx
- Integracja z auto-publish-books
- Routing w App.tsx
- Statusy 'active' w platforms.ts

Pozostaly **3 pliki** ktore nie zostaly zaktualizowane o nowe platformy:

---

## 1. AccountSelector.tsx - dodanie 7 nowych platform

Plik `src/components/campaigns/AccountSelector.tsx` laduje konta tylko dla 6 platform (X, Facebook, Instagram, TikTok, YouTube, LinkedIn). Brakuje: Threads, Telegram, Bluesky, Mastodon, Gab, Pinterest, Reddit.

**Zmiana:** Dodanie 7 nowych zapytan do bazy danych w funkcji `loadAccounts()` i mapowanie wynikow na AccountOption.

## 2. CampaignDetails.tsx - dodanie 7 nowych platform

Plik `src/pages/CampaignDetails.tsx` laduje informacje o kontach tylko dla 6 platform w `loadAccountsInfo()`. Brakuje tych samych 7 platform.

**Zmiana:** Dodanie 7 nowych blokow ladowania kont w useEffect.

## 3. OtherPlatformsContent.tsx - aktualizacja listy

Plik `src/components/dashboard/platforms/OtherPlatformsContent.tsx` nadal pokazuje TikTok, Pinterest, Reddit, Telegram, Threads, Bluesky, Mastodon jako "Planowana"/"W rozważaniu", choc wszystkie sa juz aktywne.

**Zmiana:** Usuniecie platform ktore sa juz aktywne z listy. Pozostawienie tylko BeReal (ktory faktycznie nie jest zaimplementowany) lub calkowita zmiana komponentu.

---

## Sekcja techniczna

### AccountSelector.tsx
Dodanie do `loadAccounts()` zapytan:
- `threads_oauth_tokens` -> select id, username
- `telegram_tokens` -> select id, channel_name, chat_id
- `bluesky_tokens` -> select id, handle
- `mastodon_tokens` -> select id, username, server_url
- `gab_tokens` -> select id, username
- `pinterest_oauth_tokens` -> select id, username
- `reddit_oauth_tokens` -> select id, username

### CampaignDetails.tsx
Dodanie analogicznych blokow w `loadAccountsInfo()` dla kazdej z 7 platform.

### OtherPlatformsContent.tsx
Usuniecie aktywnych platform z listy, pozostawienie tylko BeReal lub inne faktycznie planowane.
