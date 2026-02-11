
# Raport z testowania publikowania na wszystkich platformach

## Wyniki testow polaczenia (testConnection)

Wszystkie 17 edge functions odpowiedzialy poprawnie - zadna nie crashuje. Bledy "User ID required" to oczekiwane zachowanie przy braku autoryzacji.

## Znalezione problemy

### Problem 1: HTTP 500 zamiast 200 (5 funkcji)

Funkcje **tumblr**, **pinterest**, **reddit**, **snapchat** i **google-business** zwracaja HTTP 500 przy bledach (np. brak user ID), zamiast HTTP 200 z `success: false`. To powoduje bledy CORS i nieczytelne komunikaty w przegladarce.

**Dotyczy:**
- `publish-to-tumblr` - linia 90: `throw new Error` w glownym bloku, catch zwraca `status: 500`
- `publish-to-pinterest` - linia 138: to samo
- `publish-to-reddit` - linia 148: to samo
- `publish-to-snapchat` - linia 56: to samo
- `publish-to-google-business` - linia 139: to samo

**Rozwiazanie:** Zmienic `status: 500` na `status: 200` w catch block kazdej z tych funkcji, dodac wczesne zwroty z `status: 200` dla brakujacych user ID (przed `throw`).

### Problem 2: Zla kolejnosc priorytetow mediow (6 funkcji)

Wedlug ustalonej zasady: **storage_path** (Supabase Storage) powinien miec priorytet nad **image_url** (zewnetrzny URL), bo serwery platform (Instagram, Facebook) czesto nie moga pobrac zewnetrznych obrazow.

Funkcje z **bledna** kolejnoscia (image_url PRZED storage_path) w sekcji bookId:
- `publish-to-facebook` (linie 323-331 i 383-391)
- `publish-to-tumblr` (nie uzywa storage_path wcale)
- `publish-to-pinterest` (nie uzywa storage_path wcale)
- `publish-to-reddit` (nie uzywa storage_path wcale)
- `publish-to-google-business` (nie uzywa storage_path wcale)
- `publish-to-threads` (linie 127-131 - image_url przed storage_path w sekcji bookId)

Funkcje z **poprawna** kolejnoscia (wg campaign post - storage_path pierwszy):
- bluesky, mastodon, telegram, discord, gab, threads (w sekcji campaignPostId)
- linkedin (poprawne)
- instagram (poprawione w ostatniej zmianie)

**UWAGA**: Threads, Bluesky, Mastodon, Telegram, Discord, Gab - maja poprawna kolejnosc w kampaniach, ale **bledna w sekcji bookId** (image_url przed storage_path).

### Problem 3: Tumblr, Pinterest, Reddit, Google Business - brak storage_path

Te 4 funkcje w ogole nie sprawdzaja `storage_path` z tabeli books. Uzywaja tylko `image_url`, co moze powodowac problemy z pobieraniem mediow przez API platform.

## Plan napraw

### Krok 1: Naprawic HTTP 500 -> 200 (5 funkcji)
W kazdej z 5 funkcji (tumblr, pinterest, reddit, snapchat, google-business):
- Dodac wczesny return z `status: 200` i `success: false` gdy brak userId (zamiast `throw`)
- Zmienic catch block z `status: 500` na `status: 200`

### Krok 2: Ujednolicic priorytet mediow (10 funkcji)
Zmienic kolejnosc w sekcji bookId na: `storage_path` PRZED `image_url`

Dotyczy:
- **publish-to-facebook** (2 miejsca: bookId i campaignPostId sales)
- **publish-to-threads** (1 miejsce: bookId)
- **publish-to-bluesky** (1 miejsce: bookId)
- **publish-to-mastodon** (1 miejsce: bookId)
- **publish-to-telegram** (1 miejsce: bookId)
- **publish-to-discord** (1 miejsce: bookId)
- **publish-to-gab** (1 miejsce: bookId)
- **publish-to-tumblr** (dodac obsluge storage_path)
- **publish-to-pinterest** (dodac obsluge storage_path)
- **publish-to-reddit** (dodac obsluge storage_path)
- **publish-to-google-business** (dodac obsluge storage_path)

### Krok 3: Deploy wszystkich zmienionych funkcji

## Szczegoly techniczne

### Wzorzec poprawnej kolejnosci mediow (bookId):
```text
if (book.storage_path) finalImageUrl = getStoragePublicUrl(book.storage_path);
else if (book.image_url) finalImageUrl = book.image_url;
```

### Wzorzec poprawnego error handling:
```text
if (!effectiveUserId) {
  return new Response(
    JSON.stringify({ success: false, error: 'User ID is required' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### Pliki do zmiany (12 edge functions):
1. `supabase/functions/publish-to-tumblr/index.ts`
2. `supabase/functions/publish-to-pinterest/index.ts`
3. `supabase/functions/publish-to-reddit/index.ts`
4. `supabase/functions/publish-to-snapchat/index.ts`
5. `supabase/functions/publish-to-google-business/index.ts`
6. `supabase/functions/publish-to-facebook/index.ts`
7. `supabase/functions/publish-to-threads/index.ts`
8. `supabase/functions/publish-to-bluesky/index.ts`
9. `supabase/functions/publish-to-mastodon/index.ts`
10. `supabase/functions/publish-to-telegram/index.ts`
11. `supabase/functions/publish-to-discord/index.ts`
12. `supabase/functions/publish-to-gab/index.ts`

Nie wymagaja zmian (juz poprawne): publish-to-x, publish-to-instagram, publish-to-linkedin, publish-to-youtube, publish-to-tiktok.
