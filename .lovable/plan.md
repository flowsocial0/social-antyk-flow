
# Plan naprawy - 6 zgłoszonych problemów

## Przegląd problemów

| Nr | Problem | Priorytet | Złożoność |
|----|---------|-----------|-----------|
| 1 | Instagram: zmiana informacji o wymaganiach połączenia | Niski | Niska |
| 2 | LinkedIn: publikowanie działa ręcznie ale nie z kampanii | Wysoki | Średnia |
| 3 | Legal pages: zmiana nazwy/adresu dla TikTok review | Średni | Niska |
| 4 | X: błąd przy publikowaniu z kampanii (non-2xx status) | Wysoki | Niska |
| 5 | X: zmiana limitu na 15 postów/dzień z realtime tracking | Średni | Średnia |
| 6 | X zawsze pokazuje się w "Konta do publikacji" | Średni | Średnia |

---

## Problem 1: Instagram - zmiana informacji o wymaganiach

### Diagnoza
Obecna instrukcja w `PlatformInstagram.tsx` (linie 48-59) jest zbyt skomplikowana. Użytkownik chce prostszą wersję.

### Zmiany
**Plik: `src/pages/platforms/PlatformInstagram.tsx`**

Zmiana punktu 3 (linie 57-59):

Było:
```
Konto Instagram musi być połączone z tą stroną Facebook w Meta Business Suite 
(obrazek profilu - prawy górny róg → Ustawienia i prywatność → ...)
```

Będzie:
```
W Meta Business Suite → Connect Instagram (pod głównym banerem) - 
można utworzyć konto z linka połączenia w Meta Business Suite
```

---

## Problem 2: LinkedIn - błąd "Brak tekstu do publikacji" z kampanii

### Diagnoza
Analiza bazy danych pokazuje krytyczny problem:
- **platforms**: `['linkedin']` 
- **target_accounts**: `{x: ['757aa522-...']}`

Kampania jest ustawiona na LinkedIn, ale konta wybrane są dla X! To oznacza, że `auto-publish-books` szuka kont LinkedIn w `target_accounts['linkedin']`, ale tam jest puste.

Ponadto, funkcja `publish-to-linkedin` nie obsługuje parametru `campaignPostId` - szuka tylko `text` lub `bookId`.

### Zmiany

**Plik 1: `supabase/functions/publish-to-linkedin/index.ts`**

Dodanie obsługi `campaignPostId` (podobnie jak w `publish-to-x`):

```typescript
// Po linii 28 - rozszerzenie body:
const { text, imageUrl, userId: userIdFromBody, accountId, bookId, contentId, testConnection, campaignPostId } = body;

// Po linii 128 (po testConnection) - dodanie obsługi campaignPostId:
// Handle campaign post publishing
if (campaignPostId) {
  console.log('Publishing campaign post:', campaignPostId);
  
  const { data: campaignPost, error: postError } = await supabase
    .from('campaign_posts')
    .select('*')
    .eq('id', campaignPostId)
    .single();
  
  if (postError || !campaignPost) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Nie znaleziono posta kampanii',
        errorCode: 'POST_NOT_FOUND'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
  
  // Use campaign post text
  postText = campaignPost.text;
  
  // Use custom_image_url from campaign if available
  if (campaignPost.custom_image_url) {
    finalImageUrl = campaignPost.custom_image_url;
  }
  
  // If post has book_id, get book image as fallback
  if (!finalImageUrl && campaignPost.book_id) {
    const { data: bookData } = await supabase
      .from('books')
      .select('image_url, storage_path')
      .eq('id', campaignPost.book_id)
      .single();
    
    if (bookData) {
      if (bookData.storage_path) {
        finalImageUrl = `${SUPABASE_URL}/storage/v1/object/public/ObrazkiKsiazek/${bookData.storage_path}`;
      } else if (bookData.image_url) {
        finalImageUrl = bookData.image_url;
      }
    }
  }
  
  console.log('Campaign post data loaded:', {
    hasText: !!postText,
    textLength: postText?.length || 0,
    hasImage: !!finalImageUrl
  });
}
```

**Plik 2: Upewnić się, że CampaignBuilder/SimpleCampaignSetup zapisuje konta dla właściwej platformy**

Sprawdzić logikę zapisu `selected_accounts` i `target_accounts` - musi mapować platformę na jej konta, nie zawsze na X.

---

## Problem 3: Legal pages - zmiana nazwy dla TikTok review

### Diagnoza
Strony `/terms`, `/privacy` i `/data-deletion` zawierają starą nazwę domeny `social-auto-flow.netlify.app` zamiast `socialautoflow.pl`.

### Zmiany

**Plik 1: `src/pages/TermsOfService.tsx`**

Zmienić wszystkie wystąpienia:
- `social-auto-flow.netlify.app` → `socialautoflow.pl`
- `https://social-auto-flow.netlify.app` → `https://socialautoflow.pl`

Dotyczy linii: 40-41, 55-56, 66, 243

**Plik 2: `src/pages/PrivacyPolicy.tsx`**

Zmienić wszystkie wystąpienia:
- `social-auto-flow.netlify.app` → `socialautoflow.pl`
- `https://social-auto-flow.netlify.app` → `https://socialautoflow.pl`

Dotyczy linii: 40-41, 55-56

**Plik 3: `src/pages/DataDeletion.tsx`**

Zmienić nazwy (jeśli występują) na `SocialAutoFlow.pl`

---

## Problem 4: X - błąd "Edge Function returned a non-2xx status code"

### Diagnoza
Z logów widzę, że X API zwraca 429 (rate limit). Funkcja `publish-to-x` rzuca exception zamiast zwracać strukturalny błąd. Frontend pokazuje generyczny komunikat.

Logi pokazują:
```
x-app-limit-24hour-remaining: 0
status: 429 "Too Many Requests"
```

Problem polega na tym, że wewnętrzna walidacja limitu działa (widzi 0/17 tweetów z naszej bazy), ale X API sam blokuje - prawdopodobnie bo limity są współdzielone z innymi użytkownikami.

### Zmiany

**Plik: `supabase/functions/publish-to-x/index.ts`**

Upewnić się, że przy 429 zwracamy HTTP 200 z `success: false` (nie throw):

```typescript
// W funkcji sendTweet, przy obsłudze 429:
if (response.status === 429) {
  // Zapisz rate limit info...
  
  // Zamiast throw, return structured error
  return {
    success: false,
    message: 'Osiągnięto dzienny limit publikacji X. Spróbuj ponownie później.',
    errorCode: 'RATE_LIMITED',
    resetAt: resetDate?.toISOString()
  };
}
```

Upewnić się, że główny handler łapie te strukturalne błędy i przekazuje je poprawnie.

---

## Problem 5: X - zmiana limitu na 15 postów/dzień

### Diagnoza
Obecnie `X_FREE_TIER_DAILY_LIMIT = 17` (linia 8 w `publish-to-x`). Trzeba zmienić na 15 i zaktualizować wyświetlanie.

### Zmiany

**Plik 1: `supabase/functions/publish-to-x/index.ts`**
```typescript
// Linia 8
const X_FREE_TIER_DAILY_LIMIT = 15; // było 17
```

**Plik 2: `supabase/functions/get-x-rate-limits/index.ts`**
```typescript
// Linia 8
const X_APP_DAILY_LIMIT = 15; // było 1500
```

**Plik 3: `src/components/platforms/XRateLimitStatus.tsx`**
```typescript
// Linia 23
const APP_DAILY_LIMIT = 15; // było 1500

// Zmienić opis w linii 191:
"Limit X Free tier: {APP_DAILY_LIMIT} publikacji/dzień dla całej aplikacji."
```

**Mechanizm odejmowania w czasie rzeczywistym:**

Funkcja `publish-to-x` już zapisuje publikacje do `x_daily_publications` i `platform_publications`. Przy każdej udanej publikacji limit jest automatycznie zmniejszany.

Frontend odświeża dane co 60 sekund (linia 56). Można dodać real-time subscription dla natychmiastowej aktualizacji.

---

## Problem 6: X zawsze pokazuje się w "Konta do publikacji"

### Diagnoza - KRYTYCZNE
Analiza bazy danych ujawniła root cause wszystkich problemów z platformami:

```
platforms: ['linkedin']
target_accounts: {x: ['757aa522-...']}
```

Kampania ma platformę LinkedIn, ale konta są zapisane pod kluczem `x`! 

To oznacza, że kod tworzący kampanię zawsze przypisuje wybrane konta do klucza `x` zamiast do odpowiedniej platformy.

### Zmiany

**Lokalizacja problemu: `src/components/campaigns/SimpleCampaignSetup.tsx` lub `CampaignBuilder.tsx`**

Szukamy miejsca gdzie `selected_accounts` lub `target_accounts` jest budowane i zapisywane. Musi być błąd w mapowaniu - zamiast:

```typescript
target_accounts: {
  [selectedPlatform]: accountIds  // np. linkedin: [...]
}
```

Jest prawdopodobnie:
```typescript
target_accounts: {
  x: accountIds  // zawsze x!
}
```

**Plik: `src/pages/CampaignDetails.tsx` (linie 776-809)**

Dodatkowo, fallback w wyświetlaniu (linia 796-809) używa `campaign.target_platforms` gdy nie ma `selected_accounts`, ale nie filtruje pustych. Trzeba upewnić się że nie wyświetla niczego gdy nie ma danych.

Obecny kod:
```typescript
(campaign.target_platforms as string[] || []).length > 0 ? ...
```

To już wygląda poprawnie, ale problemem jest to, że `selected_accounts` istnieje ale ma złe klucze (x zamiast linkedin).

**Rozwiązanie:**
1. Znaleźć gdzie kampanie są tworzone i naprawić mapowanie platform → accounts
2. W CampaignDetails, przy wyświetlaniu, filtrować tylko te platformy które są w `platforms` tablicy posta

---

## Podsumowanie zmian

| Nr | Plik | Zmiana |
|----|------|--------|
| 1 | `src/pages/platforms/PlatformInstagram.tsx` | Uproszczenie instrukcji połączenia |
| 2 | `supabase/functions/publish-to-linkedin/index.ts` | Dodanie obsługi `campaignPostId` |
| 3 | `src/pages/TermsOfService.tsx` | Zmiana URL na socialautoflow.pl |
| 3 | `src/pages/PrivacyPolicy.tsx` | Zmiana URL na socialautoflow.pl |
| 3 | `src/pages/DataDeletion.tsx` | Zmiana URL na socialautoflow.pl |
| 4 | `supabase/functions/publish-to-x/index.ts` | Lepsza obsługa błędów 429 |
| 5 | `supabase/functions/publish-to-x/index.ts` | Zmiana limitu na 15 |
| 5 | `supabase/functions/get-x-rate-limits/index.ts` | Zmiana limitu na 15 |
| 5 | `src/components/platforms/XRateLimitStatus.tsx` | Zmiana limitu na 15 |
| 6 | Tworzenie kampanii (SimpleCampaignSetup/CampaignBuilder) | Naprawa mapowania platform → accounts |

---

## Sekcja techniczna

### Architektura problemu z target_accounts

```text
OBECNY STAN (błędny):
SimpleCampaignSetup tworzy:
  target_platforms: ['linkedin']
  selected_accounts: { x: ['account-123'] }  ❌ zawsze x!

auto-publish-books szuka:
  targetAccounts['linkedin']  → undefined
  → fallback: pobiera WSZYSTKIE konta LinkedIn usera
  → ale user może nie mieć konta LinkedIn!
  
publish-to-linkedin dostaje:
  campaignPostId: 'post-abc'
  userId: 'user-123'
  accountId: undefined (bo nie było w target_accounts)
  → szuka bookId, ale to kampania, nie book
  → text = undefined
  → ERROR: "Brak tekstu do publikacji"

POPRAWNY STAN:
SimpleCampaignSetup powinno tworzyć:
  target_platforms: ['linkedin']
  selected_accounts: { linkedin: ['linkedin-account-123'] }  ✅

publish-to-linkedin dostaje:
  campaignPostId: 'post-abc'
  → pobiera tekst z campaign_posts.text
  → SUCCESS
```

### Naprawa publish-to-linkedin dla campaignPostId

```typescript
// Nowa sekcja po testConnection:
if (campaignPostId) {
  const { data: post } = await supabase
    .from('campaign_posts')
    .select('text, custom_image_url, book_id')
    .eq('id', campaignPostId)
    .single();
    
  postText = post?.text;
  finalImageUrl = post?.custom_image_url;
  
  if (!finalImageUrl && post?.book_id) {
    // Fallback na obrazek książki
  }
}
```

### Zmiana limitów X

```text
Przed:
- X_FREE_TIER_DAILY_LIMIT = 17 (publish-to-x)
- X_APP_DAILY_LIMIT = 1500 (get-x-rate-limits)
- APP_DAILY_LIMIT = 1500 (XRateLimitStatus.tsx)

Po:
- X_FREE_TIER_DAILY_LIMIT = 15
- X_APP_DAILY_LIMIT = 15
- APP_DAILY_LIMIT = 15
```
