
# Plan naprawy: Problemy z logowaniem i publikowaniem na X i LinkedIn

## Zdiagnozowane problemy

### Problem 1: LinkedIn - brak obsługi testu połączenia

**Lokalizacja**: `supabase/functions/publish-to-linkedin/index.ts`

**Przyczyna**: Funkcja `publish-to-linkedin` nie obsługuje parametru `testConnection`, który jest używany przez `PlatformConnectionStatus` do testowania połączenia. Zamiast tego od razu próbuje publikować, co wymaga `accountId` i zwraca błąd `NO_ACCOUNT_ID`.

**Rozwiązanie**: Dodanie obsługi `testConnection` w funkcji, która sprawdzi ważność tokenu bez próby publikacji.

### Problem 2: LinkedIn - błąd publikacji bez accountId

**Lokalizacja**: `supabase/functions/publish-to-linkedin/index.ts` (linia 152-161)

**Przyczyna**: Funkcja wymaga jawnego `accountId` dla multi-account, ale niektóre miejsca w kodzie mogą nie przekazywać tego parametru (np. auto-publish).

**Rozwiązanie**: Dodanie fallbacku - jeśli brak `accountId`, pobierz domyślne lub pierwsze konto użytkownika.

### Problem 3: X OAuth - stare request tokens nie są czyszczone

**Lokalizacja**: `supabase/functions/twitter-oauth1-callback/index.ts`

**Przyczyna**: Stare tokeny wygasłe (10 min) pozostają w tabeli `twitter_oauth1_requests` i mogą powodować konflikty. Obecnie są kasowane tylko po udanym callback.

**Rozwiązanie**: Dodanie automatycznego czyszczenia wygasłych tokenów przed utworzeniem nowego.

### Problem 4: X - brak fallback dla accountId

**Lokalizacja**: `supabase/functions/publish-to-x/index.ts`

**Przyczyna**: Podobnie jak LinkedIn, niektóre wywołania mogą nie przekazywać `accountId`, co powoduje nieprzewidywalne zachowanie.

**Status**: Funkcja już ma fallback w `getOAuth1Token()` - najpierw szuka po `accountId`, potem `is_default`, potem pierwszy dostępny. To jest OK.

---

## Planowane zmiany

### Zmiana 1: Dodanie testConnection do publish-to-linkedin

**Plik**: `supabase/functions/publish-to-linkedin/index.ts`

Dodanie obsługi parametru `testConnection` na początku funkcji:

```typescript
// Po linii 28 (const { text, imageUrl, ...} = body;)
const { text, imageUrl, userId: userIdFromBody, accountId, bookId, contentId, testConnection } = body;

// Po linii 73 (if (!userId) {...})
// Handle test connection request
if (testConnection) {
  console.log('Testing LinkedIn connection...');
  
  // Get all LinkedIn tokens for user
  const { data: tokens, error: tokensError } = await supabase
    .from('linkedin_oauth_tokens')
    .select('id, display_name, linkedin_id, expires_at, access_token')
    .eq('user_id', userId);
  
  if (tokensError || !tokens || tokens.length === 0) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        connected: false,
        message: 'Brak połączonych kont LinkedIn'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
  
  // Test first token by calling LinkedIn userinfo endpoint
  const testToken = tokens[0];
  try {
    const testResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${testToken.access_token}` }
    });
    
    if (testResponse.ok) {
      const userData = await testResponse.json();
      return new Response(
        JSON.stringify({
          success: true,
          connected: true,
          accountCount: tokens.length,
          name: userData.name || testToken.display_name,
          accounts: tokens.map(t => ({ id: t.id, name: t.display_name }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } else {
      // Token expired or invalid
      return new Response(
        JSON.stringify({
          success: false,
          connected: false,
          message: 'Token LinkedIn wygasł. Połącz konto ponownie.',
          expired: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        connected: false,
        message: 'Błąd podczas testowania połączenia z LinkedIn'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
}
```

### Zmiana 2: Dodanie fallback dla accountId w LinkedIn

**Plik**: `supabase/functions/publish-to-linkedin/index.ts`

Zmiana logiki pobierania tokenu - jeśli brak `accountId`, użyj domyślnego lub pierwszego konta:

```typescript
// Zamiana linii 151-161:
let tokenQuery = supabase
  .from('linkedin_oauth_tokens')
  .select('*')
  .eq('user_id', userId);

if (accountId) {
  tokenQuery = tokenQuery.eq('id', accountId);
} else {
  // Fallback: get first account (or default if exists)
  tokenQuery = tokenQuery.order('is_default', { ascending: false }).limit(1);
  console.log('No accountId provided, using fallback to first/default account');
}

const { data: tokenData, error: tokenError } = await tokenQuery.maybeSingle();
```

### Zmiana 3: Czyszczenie wygasłych request tokens dla X

**Plik**: `supabase/functions/twitter-oauth1-start/index.ts`

Dodanie czyszczenia wygasłych tokenów przed utworzeniem nowego:

```typescript
// Przed linią 145 (// Store request token in database)
// Clean up expired request tokens for this user
console.log("Cleaning up expired request tokens...");
const { error: cleanupError } = await supabase
  .from('twitter_oauth1_requests')
  .delete()
  .eq('user_id', user.id)
  .lt('expires_at', new Date().toISOString());

if (cleanupError) {
  console.warn('Failed to cleanup expired tokens:', cleanupError);
} else {
  console.log('Expired tokens cleaned up');
}
```

### Zmiana 4: Lepsze logowanie błędów w LinkedIn callback

**Plik**: `supabase/functions/linkedin-oauth-callback/index.ts`

Dodanie dodatkowego logowania dla debugowania:

```typescript
// Po linii 97 (const tokenResponse = await fetch...)
console.log('LinkedIn token response status:', tokenResponse.status);
console.log('LinkedIn token response headers:', Object.fromEntries(tokenResponse.headers.entries()));
```

---

## Podsumowanie zmian

| Problem | Plik | Zmiana |
|---------|------|--------|
| LinkedIn testConnection | `publish-to-linkedin` | Dodanie obsługi `testConnection` z testem API userinfo |
| LinkedIn brak accountId | `publish-to-linkedin` | Fallback na domyślne/pierwsze konto użytkownika |
| X stare request tokens | `twitter-oauth1-start` | Czyszczenie wygasłych tokenów przed nowym żądaniem |
| LinkedIn debugging | `linkedin-oauth-callback` | Lepsze logowanie odpowiedzi API |

---

## Sekcja techniczna

### Architektura testConnection

```text
Frontend (PlatformConnectionStatus)
    │
    ▼ testConnection: true
┌─────────────────────────────────────┐
│ publish-to-linkedin Edge Function   │
├─────────────────────────────────────┤
│ 1. Sprawdź userId (JWT lub body)    │
│ 2. Pobierz tokeny z bazy            │
│ 3. Wywołaj LinkedIn userinfo API    │
│ 4. Zwróć status połączenia          │
└─────────────────────────────────────┘
    │
    ▼
LinkedIn API: GET /v2/userinfo
    │
    ▼
{ success: true, connected: true, accountCount: 2, name: "..." }
```

### Fallback dla accountId

Logika wyboru konta:
1. Jeśli `accountId` podany → użyj tego konkretnego konta
2. Jeśli brak → posortuj po `is_default DESC` i weź pierwsze
3. Jeśli brak kont → zwróć błąd `NO_LINKEDIN_TOKEN`

### Czyszczenie request tokens

Request tokens X.com wygasają po 10 minutach. Przed każdym nowym żądaniem OAuth:
- Usuwamy wszystkie tokeny danego użytkownika gdzie `expires_at < NOW()`
- To zapobiega konfliktom i utrzymuje tabelę czystą

### Potencjalne dodatkowe problemy

1. **LinkedIn token refresh**: LinkedIn tokeny wygasają po 60 dniach. Obecnie brak mechanizmu automatycznego odświeżania - użytkownik musi ręcznie połączyć konto ponownie.

2. **X rate limiting**: Free tier X API pozwala na 17 tweetów/24h per użytkownik i 1500/miesiąc per aplikację. To jest już obsługiwane w kodzie.
