
# Plan: Usunięcie nieprawidłowego scope `pages_manage_metadata`

## Problem

Komunikat od Facebooka mówi:
> **Invalid Scopes: pages_manage_metadata**. This message is only shown to developers.

Scope `pages_manage_metadata` nie jest poprawnym uprawnieniem Facebook Login i powinien zostać usunięty. Facebook i tak go ignoruje dla zwykłych użytkowników, ale dla deweloperów wyświetla ten mylący komunikat.

## Rozwiązanie

### Zmiana w pliku `supabase/functions/facebook-oauth-start/index.ts`

Usunięcie `pages_manage_metadata` z listy scope'ów:

**Przed (linia 44-51):**
```typescript
const scopes = [
  'public_profile',
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_manage_metadata',  // ← USUNĄĆ - nieprawidłowy scope
  'business_management'
].join(',');
```

**Po:**
```typescript
const scopes = [
  'public_profile',
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'business_management'
].join(',');
```

### Deploy

Ponowny deploy Edge Function `facebook-oauth-start`.

## Wynik

Po tej zmianie:
- Komunikat "Invalid Scopes" przestanie się pojawiać
- OAuth flow dla Facebooka będzie czyste, bez ostrzeżeń
- Wszystkie potrzebne uprawnienia do publikacji na stronach pozostaną (pages_manage_posts, pages_read_engagement, business_management)
