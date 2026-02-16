

## Naprawa publikacji video na Tumblr

### Problem

Tumblr zwraca blad 8005 ("media format not supported") przy uploadzievideo. Analiza wskazuje na 3 przyczyny:

1. Blob z video nie ma ustawionego typu `video/mp4`, a filename to `'0'` bez rozszerzenia -- Tumblr nie rozpoznaje formatu
2. Wymiary 1920x1080 sa hardcoded i nie odpowiadaja rzeczywistym wymiarom pliku
3. Pliki video moga miec nieobslugiwany kodek (Tumblr wymaga H.264 + AAC)

### Plan zmian

#### Zmiana 1: Poprawne FormData (plik `supabase/functions/publish-to-tumblr/index.ts`)

Linia 133 -- zmiana z:
```text
formData.append(videoIdentifier, new Blob([videoArrayBuffer]), '0');
```
na:
```text
formData.append(videoIdentifier, new Blob([videoArrayBuffer], { type: 'video/mp4' }), 'video.mp4');
```

To zapewni:
- Poprawny `Content-Type: video/mp4` w czesci multipart
- Poprawny `filename="video.mp4"` w Content-Disposition

#### Zmiana 2: Usuniecie hardcoded wymiarow

Linie 117-120 -- zamiast stalych 1920x1080, nie podawac wymiarow w ogole (sa opcjonalne wg NPF spec) lub ustawic bardziej typowe wartosci. Bezpieczniej jest je pominac:

```text
media: {
  type: 'video/mp4',
  identifier: videoIdentifier,
},
```

Tumblr sam odczyta wymiary z pliku po przetworzeniu.

#### Zmiana 3: Logowanie Content-Type z odpowiedzi video

Dodac log sprawdzajacy Content-Type pobranego pliku, zeby zdiagnozowac czy plik jest rzeczywiscie MP4:

```text
const contentType = videoResponse.headers.get('content-type');
console.log(`Video content-type from source: ${contentType}`);
```

Jesli okaze sie ze pliki nie sa H.264/AAC, to bedzie trzeba je transkodowac przed uploadem (ale to osobny krok).

### Podsumowanie

Zmiana dotyczy jednego pliku: `supabase/functions/publish-to-tumblr/index.ts`. Trzy poprawki:
1. Explicit `video/mp4` type na Blobie + filename `video.mp4`
2. Usuniecie hardcoded width/height z NPF payload
3. Dodatkowe logowanie content-type zrodlowego pliku

Po wdrozeniu -- test publikacji video. Jesli nadal blad 8005, problem lezy w kodeku samych plikow video.

