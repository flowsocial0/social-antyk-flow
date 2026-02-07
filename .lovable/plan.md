

# Plan naprawy - 2 problemy

## Problem 1: X - "Sales post missing book image"

### Diagnoza
Blad z obrazka: `Sales post missing book image (no storage_path or image_url)` - kod bledu: `PUBLISH_FAILED`

W `publish-to-x/index.ts` (linie 1128-1183), logika obrazkow kampanii sprawdza TYLKO:
- `campaignPost.book?.image_url`
- `campaignPost.book?.storage_path`

Nie sprawdza:
- `campaignPost.custom_image_url` (obrazek dodany bezposrednio do posta kampanii)

Ponadto, jesli post jest typu `sales` i nie ma obrazka, rzuca blad zamiast pozwolic na publikacje samego tekstu (linia 1181-1182).

### Zmiany

**Plik: `supabase/functions/publish-to-x/index.ts`** (linie 1128-1183)

Dodac obsluge `custom_image_url` z kampanii PRZED sprawdzaniem book images:

```typescript
let mediaIds: string[] = [];

// Priority 1: custom_image_url from campaign post
if (campaignPost.custom_image_url) {
  try {
    const mediaId = await uploadMedia(campaignPost.custom_image_url, ...);
    mediaIds = [mediaId];
  } catch (error) {
    console.error("Custom image upload failed:", error);
    // Don't fail - try book image as fallback
  }
}

// Priority 2: book image (only if no custom image uploaded)
if (mediaIds.length === 0 && (campaignPost.book?.storage_path || campaignPost.book?.image_url)) {
  // ... existing book image logic
}

// Priority 3: sales post without ANY image - allow text-only instead of failing
if (mediaIds.length === 0 && campaignPost.type === 'sales') {
  console.warn('Sales post has no image - publishing text only');
  // Remove the throw - allow text-only publishing
}
```

---

## Problem 2: OAuth redirect URLs - stary adres netlify

### Diagnoza
Dwa pliki maja stary fallback `social-auto-flow.netlify.app` zamiast `socialautoflow.pl`:

| Plik | Linia | Obecny fallback |
|------|-------|----------------|
| `facebook-oauth-callback/index.ts` | 29, 311 | `social-auto-flow.netlify.app` |
| `instagram-oauth-callback/index.ts` | 10 | `social-auto-flow.netlify.app` |
| `facebook-data-deletion/index.ts` | 63 | `social-auto-flow.netlify.app` |

LinkedIn juz ma poprawny fallback (`socialautoflow.pl`).

**Uwaga**: Te fallbacki sa uzywane tylko gdy zmienna `FRONTEND_URL` nie jest ustawiona w env. Jesli `FRONTEND_URL` jest ustawione poprawnie w Supabase secrets, to te fallbacki nie sa aktywne. Ale nalezy je zaktualizowac na wypadek braku zmiennej.

### Zmiany

**Plik 1: `supabase/functions/facebook-oauth-callback/index.ts`**
- Linia 29: zmiana `'https://social-auto-flow.netlify.app'` na `'https://socialautoflow.pl'`
- Linia 311: zmiana `'https://social-auto-flow.netlify.app'` na `'https://socialautoflow.pl'`

**Plik 2: `supabase/functions/instagram-oauth-callback/index.ts`**
- Linia 10: zmiana `'https://social-auto-flow.netlify.app'` na `'https://socialautoflow.pl'`

**Plik 3: `supabase/functions/facebook-data-deletion/index.ts`**
- Linia 63: zmiana `social-auto-flow.netlify.app` na `socialautoflow.pl`

---

## Podsumowanie

| Plik | Zmiana |
|------|--------|
| `supabase/functions/publish-to-x/index.ts` | Obsluga custom_image_url + pozwolenie na sales bez obrazka |
| `supabase/functions/facebook-oauth-callback/index.ts` | Zmiana fallback URL na socialautoflow.pl |
| `supabase/functions/instagram-oauth-callback/index.ts` | Zmiana fallback URL na socialautoflow.pl |
| `supabase/functions/facebook-data-deletion/index.ts` | Zmiana URL na socialautoflow.pl |

## Sekcja techniczna

### Priorytet obrazkow w publish-to-x (kampanie)

```text
1. campaignPost.custom_image_url  (dodany reczne do posta kampanii)
2. campaignPost.book.storage_path (obrazek ksiazki z Supabase Storage)
3. campaignPost.book.image_url    (zewnetrzny URL obrazka ksiazki)
4. Brak obrazka                   (publikuj sam tekst - nie rzucaj bledu)
```

### Fallback URL w OAuth callbacks

```text
Kazdy callback uzywa: Deno.env.get('FRONTEND_URL') || 'https://...'
Jesli FRONTEND_URL jest ustawione -> uzywa go (poprawne)
Jesli NIE jest ustawione -> uzywa fallbacku (musi byc socialautoflow.pl)
```
