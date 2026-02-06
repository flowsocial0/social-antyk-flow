
# Plan naprawy - 9 zglosszonych problemow

## Przegld problemow

| Nr | Problem | Priorytet | Zlozonosc |
|----|---------|-----------|-----------|
| 2 | Limity X: 15/dzien, wspoldzielone dla calej aplikacji | Sredni | Niska |
| 3 | LinkedIn kampania: "brak tekstu" mimo dodania tekstu | Wysoki | Srednia |
| 4 | LinkedIn kampania: brak konta w "Konta do publikacji" | Wysoki | Niska |
| 5 | Edycja daty posta: tytul dnia sie nie zmienia | Niski | Niska |
| 6 | LinkedIn: konto widoczne na liscie kampanii, ale nie w szczegolach | Wysoki | Niska |
| 7 | X: blad "non-2xx status code" przy publikowaniu | Wysoki | Srednia |
| 8 | Instagram: dziwne hashtagi #ksiazki #antykwariat | Sredni | Niska |
| 9 | LinkedIn video: "opublikowalo" ale nie widac na LinkedIn | Wysoki | Srednia |

---

## Problem 2: Limity X - 15/dzien, wspoldzielone

### Diagnoza
Limit jest juz ustawiony na 15 w kodzie (`X_FREE_TIER_DAILY_LIMIT = 15`, `X_APP_DAILY_LIMIT = 15`, `APP_DAILY_LIMIT = 15`). Ale `checkDailyPublicationLimit` liczy publikacje per konto (`account_id`), a nie per cala aplikacja. Trzeba zmienic na globalny count.

### Zmiany

**Plik: `supabase/functions/publish-to-x/index.ts`**
- Funkcja `checkDailyPublicationLimit` (linie 231-282): usunac filtr `.eq('account_id', accountId)` i liczyc WSZYSTKIE publikacje w ostatnich 24h
- Zmienic sygnature: nie wymaga `accountId`, liczy globalnie

```typescript
async function checkDailyPublicationLimit(
  supabaseClient: any
): Promise<{ canPublish: boolean; publishedToday: number; resetAt: Date }> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Count ALL X publications across ALL users in last 24 hours
  const { count, error } = await supabaseClient
    .from('x_daily_publications')
    .select('*', { count: 'exact', head: true })
    .gte('published_at', twentyFourHoursAgo.toISOString());
  // NO .eq('account_id', ...) - count globally
  
  const publishedToday = count || 0;
  const canPublish = publishedToday < X_FREE_TIER_DAILY_LIMIT;
  // ... rest same
}
```

- Zaktualizowac wszystkie wywolania `checkDailyPublicationLimit` w pliku (linie ~1018, ~1342) - usunac argument `xAccountId`

---

## Problem 3: LinkedIn kampania - "brak tekstu do publikacji"

### Diagnoza
Sprawdzilem baze danych - nowe kampanie LinkedIn maja poprawne mapowanie (`linkedin: [...]`). Problem polega na tym, ze `publish-to-linkedin` juz obsluguje `campaignPostId` (linie 135-186), ale moze byc problem z kolejnoscia warunkow. Jesli `campaignPostId` i `bookId` sa oba podane, sekcja `bookId` (linie 188-246) nadpisuje tekst. Ponadto auto-publish-books moze przekazywac `bookId` obok `campaignPostId`.

### Zmiany

**Plik: `supabase/functions/publish-to-linkedin/index.ts`**
- Dodac warunek `if (bookId && !campaignPostId)` zamiast `if (bookId)` na linii 189 - zeby sekcja bookId nie nadpisywala tekstu z kampanii
- Dodac lepsze logowanie bledow

```typescript
// Linia 189 - zmiana warunku:
if (bookId && !campaignPostId) {
  // ... existing bookId logic
}
```

---

## Problem 4 i 6: LinkedIn - brak konta w szczegolach kampanii

### Diagnoza
W `CampaignDetails.tsx` funkcja `loadAccountsInfo` (linie 140-227) laduje konta X, Facebook, Instagram, TikTok, YouTube - ale **brakuje LinkedIn**! To dlatego konta LinkedIn nie wyswietlaja sie w sekcji "Konta do publikacji".

### Zmiany

**Plik: `src/pages/CampaignDetails.tsx`**
- Dodac sekcje ladowania kont LinkedIn po YouTube (po linii 224):

```typescript
// Load LinkedIn accounts
if (selectedAccounts.linkedin?.length) {
  const { data } = await (supabase as any)
    .from('linkedin_oauth_tokens')
    .select('id, display_name, account_name')
    .in('id', selectedAccounts.linkedin);
  data?.forEach((a: any) => {
    newAccountsMap[a.id] = {
      id: a.id,
      display_name: a.display_name || a.account_name || 'Profil LinkedIn',
      platform: 'linkedin'
    };
  });
}
```

---

## Problem 5: Edycja daty posta - tytul dnia sie nie zmienia

### Diagnoza
Gdy uzytkownik zmienia date posta w harmonogramie, post jest aktualizowany w bazie, ale tytuly dni ("Dzien 1 - sobota, 7 lutego") sa obliczane na podstawie `campaign.start_date` i numeru dnia (`post.day`), nie na podstawie `post.scheduled_at`. Jesli zmieni sie godzine/date w `scheduled_at` ale nie zmieni `day`, tytul zostaje taki sam.

### Zmiany

**Plik: `src/pages/CampaignDetails.tsx`**
- Przy grupowaniu postow wg dni, uzyc `scheduled_at` do generowania tytulu dnia zamiast obliczania z `start_date + day`
- Modyfikacja w sekcji grupowania postow - uzyc rzeczywistej daty z `scheduled_at`:

```typescript
// Zamiast:
const dayDate = new Date(new Date(campaign.start_date).getTime() + (dayNum - 1) * 24 * 60 * 60 * 1000);

// Uzywaj rzeczywistej daty z pierwszego posta w danym dniu:
const firstPostInDay = dayPosts[0];
const dayDate = firstPostInDay ? new Date(firstPostInDay.scheduled_at) : 
  new Date(new Date(campaign.start_date).getTime() + (dayNum - 1) * 24 * 60 * 60 * 1000);
```

---

## Problem 7: X - blad "non-2xx status code"

### Diagnoza
Funkcja `publish-to-x` zwraca HTTP 429 (linia 1043) i HTTP 403/500 (linie 1322-1324) dla bledow kampanii. Supabase client traktuje non-2xx jako blad i wyswietla generyczny komunikat "Edge Function returned a non-2xx status code" zamiast wlasciwego komunikatu.

Zgodnie z memoria `error-handling/expected-edge-response-standard`, wszystkie oczekiwane bledy powinny zwracac HTTP 200 z `success: false`.

### Zmiany

**Plik: `supabase/functions/publish-to-x/index.ts`**

1. Linia 1043: zmiana `status: 429` na `status: 200` w daily limit response
2. Linia 1075: zmiana `status: 429` na `status: 200` w API rate limit response  
3. Linia 1322: zmiana `status: isForbiddenError ? 403 : 500` na `status: 200` w error response
4. Upewnic sie ze wszystkie bledy kampanii zwracaja HTTP 200 z `success: false` i opisowym `message`

---

## Problem 8: Instagram - hardcoded hashtagi

### Diagnoza
W `publish-to-instagram/index.ts` (linia 324) jest hardcoded:
```typescript
postCaption += '\n\n#książki #antykwariat';
```

Te hashtagi sa dodawane do KAZDEGO posta na Instagramie, niezaleznie od tresci.

### Zmiany

**Plik: `supabase/functions/publish-to-instagram/index.ts`**
- Usunac hardcoded hashtagi (linia 324)
- Zamiast tego, uzyc AI suffiksu z `user_settings.ai_suffix_instagram` ktory uzytkownik moze sam ustawic:

```typescript
// Linia 322-328 - zmiana:
if (postCaption && aiSuffix) {
  postCaption += `\n\n${aiSuffix}`;
}
// Usunieto: postCaption += '\n\n#książki #antykwariat';
```

---

## Problem 9: LinkedIn video - nie widac na LinkedIn

### Diagnoza
Obecny kod `publish-to-linkedin` (linie 313-331) uzywa `urn:li:digitalmediaRecipe:feedshare-image` do rejestracji uploadu. Dla wideo trzeba uzyc `urn:li:digitalmediaRecipe:feedshare-video` i ustawic `shareMediaCategory` na `'VIDEO'` zamiast `'IMAGE'`.

Ponadto wideo na LinkedIn wymaga dodatkowego kroku - czekania az LinkedIn przetworzy wideo (podobnie jak na Instagramie).

### Zmiany

**Plik: `supabase/functions/publish-to-linkedin/index.ts`**

1. Dodac funkcje pomocnicza `isVideoUrl`:
```typescript
function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(url);
}
```

2. Zmienic logike uploadu mediow (linie 310-368):
```typescript
const isVideo = isVideoUrl(finalImageUrl);

// Krok 1: Rejestracja uploadu z odpowiednim recipe
const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({
    registerUploadRequest: {
      recipes: [isVideo 
        ? 'urn:li:digitalmediaRecipe:feedshare-video'
        : 'urn:li:digitalmediaRecipe:feedshare-image'
      ],
      owner: `urn:li:person:${linkedinId}`,
      serviceRelationships: [...]
    }
  })
});
```

3. Zmienic `shareMediaCategory` na odpowiedni typ:
```typescript
shareMediaCategory: mediaAssets.length > 0 
  ? (isVideoMedia ? 'VIDEO' : 'IMAGE') 
  : 'NONE',
```

4. Dla wideo dodac oczekiwanie na przetworzenie (polling asset status):
```typescript
if (isVideo) {
  // Poll asset status until READY
  let assetReady = false;
  for (let i = 0; i < 60; i++) {
    const statusResponse = await fetch(
      `https://api.linkedin.com/v2/assets/${encodeURIComponent(asset)}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const statusData = await statusResponse.json();
    if (statusData.recipes?.[0]?.status === 'AVAILABLE') {
      assetReady = true;
      break;
    }
    await new Promise(r => setTimeout(r, 3000)); // wait 3s
  }
  if (!assetReady) {
    throw new Error('Przetwarzanie wideo LinkedIn przekroczylo limit czasu');
  }
}
```

---

## Podsumowanie zmian wedlug plikow

| Plik | Zmiana |
|------|--------|
| `supabase/functions/publish-to-x/index.ts` | Globalny limit 15/dzien (nie per konto), HTTP 200 dla bledow |
| `supabase/functions/publish-to-linkedin/index.ts` | Fix bookId vs campaignPostId, obsluga wideo |
| `supabase/functions/publish-to-instagram/index.ts` | Usuniecie hardcoded hashtagow |
| `src/pages/CampaignDetails.tsx` | Dodanie ladowania kont LinkedIn, tytul dnia z scheduled_at |

---

## Sekcja techniczna

### Globalny limit X vs per-konto

```text
OBECNY STAN (bledny):
  checkDailyPublicationLimit(supabaseClient, accountId)
  -> liczy: x_daily_publications WHERE account_id = 'abc'
  -> Uzytkownik A opublikowal 5 tweetow = widzi 5/15
  -> Uzytkownik B opublikowal 10 tweetow = widzi 10/15
  -> RAZEM: 15, ale kazdy widzi swoje osobno!

POPRAWNY STAN:
  checkDailyPublicationLimit(supabaseClient)
  -> liczy: x_daily_publications (BEZ filtra account_id)
  -> Wszyscy widza: 15/15 - limit wyczerpany
```

### LinkedIn video upload flow

```text
1. Register Upload
   recipe: feedshare-video (nie feedshare-image!)
   
2. Download video from URL

3. Upload video to LinkedIn (PUT)

4. Poll asset status
   GET /v2/assets/{asset}
   Wait until recipes[0].status === 'AVAILABLE'
   (moze trwac 1-3 minuty)

5. Create UGC Post
   shareMediaCategory: 'VIDEO' (nie 'IMAGE')
   media: [{ status: 'READY', media: asset }]
```

### HTTP status codes w publish-to-x

```text
OBECNY STAN (bledny):
  Daily limit -> HTTP 429 -> Supabase client: "non-2xx error"
  Rate limit -> HTTP 429 -> Supabase client: "non-2xx error"
  Forbidden -> HTTP 403 -> Supabase client: "non-2xx error"
  Unknown -> HTTP 500 -> Supabase client: "non-2xx error"

POPRAWNY STAN:
  Daily limit -> HTTP 200, { success: false, message: "..." }
  Rate limit -> HTTP 200, { success: false, message: "..." }
  Forbidden -> HTTP 200, { success: false, message: "..." }
  Unknown -> HTTP 200, { success: false, message: "..." }
```
