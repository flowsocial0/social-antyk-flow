

## Problem: Video upload na Tumblr zwraca blad 8005 "media format not supported"

### Analiza przyczyny

Tumblr API zwraca blad `8005: "Sorry, we don't support this media format yet."` przy probie uploadu video. Tekst i obrazki dzialaja poprawnie.

Kluczowe roznice miedzy dzialajacymi a niedzialajacymi postami:
- **Tekst/obrazki**: wysylane jako JSON z URL do obrazka -- Tumblr sam pobiera obraz z URL
- **Video**: wymaga uploadu binarnego pliku przez multipart/form-data -- tutaj pojawia sie blad

Po analizie jedynej dzalajacej biblioteki do video upload (pytumblr2), znalazlem ze uzywa ona **OAuth1** (consumer key + consumer secret + oauth token + oauth secret), nie OAuth2 Bearer token. Obecna implementacja uzywa OAuth2.

### Proponowane rozwiazanie: Dwa podejscia

**Podejscie A (prostsze, do wyprobowania najpierw):** Video jako URL zamiast binary upload

Zamiast pobierac video i uploadowac jako binaria, sprobowac wyslac video jako URL w bloku NPF (tak samo jak obrazki):
```text
{ type: "video", url: "https://..." }
```
Tumblr moze pobrac video z URL sam, tak jak robi to z obrazkami. To eliminuje problem z multipart upload.

**Podejscie B (jesli A nie zadziala):** Przejscie na OAuth1 dla video upload

Wymaga:
1. Uzycia TUMBLR_API_KEY (consumer key) i TUMBLR_API_SECRET (consumer secret) jako OAuth1 credentials
2. Przechowywania OAuth1 token i secret dla kazdego uzytkownika (dodatkowe pola w tabeli `tumblr_oauth_tokens`)
3. Implementacji OAuth1 signature w edge function (bez biblioteki requests-oauthlib, recznie lub z uzyciem biblioteki Deno)

### Plan implementacji

#### Krok 1: Podejscie A -- Video jako URL (zmiana w edge function)

Zmodyfikowac `supabase/functions/publish-to-tumblr/index.ts`:

Zamiast pobierac video i budowac multipart FormData, wyslac zwykly JSON POST z blokiem video zawierajacym URL:

```text
{
  content: [
    { type: "text", text: "..." },
    { type: "video", url: "https://direct-url-to-video.mp4" }
  ],
  state: "published"
}
```

Usunac caly blok kodu odpowiedzialny za pobieranie video, tworzenie FormData, i multipart upload. Zamiast tego uzyc tej samej sciezki co dla obrazkow -- zwykly JSON POST.

#### Krok 2: Testowanie

Wdrozyc zmiane i przetestowac publikacje video.

#### Krok 3 (jesli A nie zadziala): Podejscie B -- OAuth1

Jesli Tumblr nie akceptuje video URL w NPF i wymaga binary upload z OAuth1:
- Dodanie kolumn `oauth1_token` i `oauth1_secret` do tabeli `tumblr_oauth_tokens`
- Stworzenie flow OAuth1 (nowe edge functions)
- Implementacja OAuth1 HMAC-SHA1 signature w Deno
- Uzycie OAuth1 tylko dla video upload, OAuth2 dla reszty

### Techniczne szczegoly

Zmiana dotyczy jednego pliku: `supabase/functions/publish-to-tumblr/index.ts`

W sekcji `if (videoMediaUrl)` -- zamiast pobierania video i multipart upload, wyslac JSON z blokiem:
```text
{ type: "video", url: videoMediaUrl }
```
Uzyc tego samego `fetch` co dla postow tekstowych/obrazkowych (Content-Type: application/json).

Caly blok z `FormData`, `Blob`, `File`, pobieraniem video -- zostanie usuniety i zastapiony prostsza logika JSON.

