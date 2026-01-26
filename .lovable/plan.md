
# Plan: Naprawienie błędu "Nie znaleziono stron Facebook" dla stron z Business Portfolio

## Diagnoza problemu

Zbadałem logi Edge Functions i znalazłem przyczynę:

```
Full pages response: {"data":[]}
Granted permissions: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", ...]
```

Facebook API zwraca pustą listę stron, mimo że wszystkie uprawnienia są nadane.

**Przyczyna**: Od 2023 roku Meta wymaga dodatkowego uprawnienia `business_management` dla stron zarządzanych przez **Facebook Business Portfolio** (Meta Business Suite). Twoja strona "Profesjonalna strona" jest powiązana z Business Portfolio, dlatego nie pojawia się w API.

Strona "Glowaccy" działa, ponieważ prawdopodobnie jest stroną osobistą (nie powiązaną z Business Portfolio).

---

## Plan naprawy

### Krok 1: Dodanie uprawnienia `business_management` do Facebook OAuth

**Plik**: `supabase/functions/facebook-oauth-start/index.ts`

Dodanie `business_management` i `pages_manage_metadata` do listy scope'ów:

```typescript
const scopes = [
  'public_profile',
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_manage_metadata',
  'business_management'  // NOWE - wymagane dla stron z Business Portfolio
].join(',');
```

### Krok 2: Dodanie uprawnienia `business_management` do Instagram OAuth

**Plik**: `supabase/functions/instagram-oauth-start/index.ts`

Dodanie `business_management` i `pages_manage_posts` do listy scope'ów:

```typescript
const scopes = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',        // NOWE - potrzebne do publikacji
  'instagram_basic',
  'instagram_content_publish',
  'business_management'        // NOWE - wymagane dla stron z Business Portfolio
].join(',');
```

### Krok 3: Ulepszone logowanie diagnostyczne w callback

**Plik**: `supabase/functions/facebook-oauth-callback/index.ts`

Dodanie sprawdzenia czy `business_management` zostało nadane i lepszego komunikatu błędu:

```typescript
// Sprawdź czy business_management jest nadane
const hasBusinessManagement = grantedPermissions.includes('business_management');
console.log('Has business_management:', hasBusinessManagement);

if (!pagesData.data || pagesData.data.length === 0) {
  // Bardziej precyzyjny komunikat błędu
  let errorMessage = 'Nie znaleziono żadnych stron Facebook.';
  if (!hasBusinessManagement) {
    errorMessage += ' Jeśli Twoje strony są zarządzane przez Meta Business Suite, upewnij się, że zaakceptowałeś uprawnienie "business_management".';
  }
  // ...
}
```

### Krok 4: Deploy Edge Functions

Po zmianach, automatyczny deploy:
- `facebook-oauth-start`
- `facebook-oauth-callback`
- `instagram-oauth-start`
- `instagram-oauth-callback`

---

## Ważna uwaga: Facebook App Review

Uprawnienie `business_management` wymaga przejścia procesu **Facebook App Review** aby działać dla użytkowników innych niż deweloperzy/testerzy aplikacji.

**Tymczasowe obejście** (bez App Review):
1. Wejdź w ustawienia aplikacji Facebook: https://developers.facebook.com/apps/
2. Dodaj siebie jako testera/dewelopera aplikacji
3. Jako tester/deweloper będziesz mógł używać wszystkich uprawnień

**Aby działało dla wszystkich użytkowników**, konieczne jest:
1. Przejście App Review dla `business_management`
2. Lub odłączenie strony z Business Portfolio (ale to nie jest praktyczne rozwiązanie)

---

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `supabase/functions/facebook-oauth-start/index.ts` | Dodanie `business_management` do scope |
| `supabase/functions/instagram-oauth-start/index.ts` | Dodanie `business_management` i `pages_manage_posts` do scope |
| `supabase/functions/facebook-oauth-callback/index.ts` | Lepsze logowanie i komunikaty błędów |
| `supabase/functions/instagram-oauth-callback/index.ts` | Lepsze logowanie błędów |

Po implementacji będziesz musiał:
1. Ponownie połączyć konto Facebook (kliknąć "Połącz Facebook")
2. Facebook pokaże nowe okno z prośbą o dodatkowe uprawnienia `business_management`
3. Zaakceptować wszystkie uprawnienia
4. Teraz strony z Business Portfolio powinny się pojawić
