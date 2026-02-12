

# Obsluga linkow Mega.nz w kampaniach AI

## Problem

Kampanie AI publikuja posty automatycznie przez Edge Function `auto-publish-books`, ktora dziala na serwerze (Deno). Gdy ksiazka ma `video_url` wskazujacy na Mega.nz, ten link jest przekazywany bezposrednio do funkcji publikujacych (np. `publish-to-tiktok`), ktore probuja go pobrac przez `fetch()`. Mega.nz zwraca strone HTML zamiast pliku wideo, wiec publikacja konczy sie bledem.

## Rozwiazanie

Dodanie logiki rozwiazywania linkow Mega.nz bezposrednio w Edge Function `auto-publish-books`. Przed wywolaniem funkcji publikujacej:

1. Sprawdz czy `video_url` to link Mega.nz
2. Jesli tak - pobierz i odszyfruj plik uzywajac `megajs` w Deno
3. Wgraj do tymczasowego Storage (`temp-videos/...`)
4. Przekaz tymczasowy publiczny URL do funkcji publikujacej
5. Po zakonczeniu publikacji (niezaleznie od wyniku) - usun plik tymczasowy

```text
auto-publish-books
    |
    v
[Czy video_url to mega.nz?]
    |          |
   TAK        NIE
    |          |
    v          v
[megajs:       [Przekaz URL
 download +    bezposrednio]
 decrypt]
    |
    v
[Upload do temp
 Storage]
    |
    v
[Przekaz temp URL
 do publish-to-*]
    |
    v
[Po publikacji:
 usun temp plik]
```

## Zakres zmian

| Plik | Zmiana |
|------|--------|
| `supabase/functions/auto-publish-books/index.ts` | Dodanie importu `megajs`, funkcji `resolveMegaUrl()` do pobierania/deszyfrowania/uploadu tymczasowego, wywolanie przed kazdym publish, cleanup po publikacji |

## Szczegoly techniczne

### Funkcja resolveMegaUrl w auto-publish-books

```typescript
import { File as MegaFile } from 'https://esm.sh/megajs@1.3.9';

const MEGA_REGEX = /^https?:\/\/mega\.nz\/(file|folder)\//;

async function resolveMegaUrl(
  videoUrl: string, 
  postId: string, 
  supabase: any, 
  supabaseUrl: string
): Promise<{ resolvedUrl: string; tempPath: string | null }> {
  if (!MEGA_REGEX.test(videoUrl)) {
    return { resolvedUrl: videoUrl, tempPath: null };
  }

  const tempPath = `temp-videos/${postId}-${Date.now()}.mp4`;
  const file = MegaFile.fromURL(videoUrl);
  await file.loadAttributes();
  const buffer = await file.downloadBuffer({});
  const blob = new Blob([new Uint8Array(buffer)], { type: 'video/mp4' });

  const { error } = await supabase.storage
    .from('ObrazkiKsiazek')
    .upload(tempPath, blob, { upsert: true });

  if (error) throw new Error(`Mega temp upload failed: ${error.message}`);

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${tempPath}`;
  return { resolvedUrl: publicUrl, tempPath };
}
```

### Integracja w petli publikacji kampanii

W sekcji gdzie obliczany jest `videoUrl` (linie ~449-457), po wyznaczeniu finalnego URL:

```typescript
// Resolve Mega.nz URLs to temp storage
let tempPath: string | null = null;
if (videoUrl && MEGA_REGEX.test(videoUrl)) {
  console.log(`Resolving Mega.nz URL for post ${post.id}`);
  const resolved = await resolveMegaUrl(videoUrl, post.id, supabase, supabaseUrl);
  videoUrl = resolved.resolvedUrl;
  tempPath = resolved.tempPath;
}
```

Po zakonczeniu publikacji na wszystkie konta danego posta, cleanup:

```typescript
// Clean up any temp Mega files
if (tempPath) {
  await supabase.storage.from('ObrazkiKsiazek').remove([tempPath]);
  console.log(`Cleaned up temp Mega file: ${tempPath}`);
}
```

### Ograniczenia i obsluga bledow

- **Timeout**: Edge Functions maja limit 60s. Duze pliki wideo moga nie zdazyc sie pobrac. Jesli `resolveMegaUrl` rzuci blad, post zostanie oznaczony jako `failed` z odpowiednim komunikatem.
- **Pamiec**: Limit ~150MB RAM. Filmy powyzej ~100MB moga powodowac problemy. W komunikacie bledu uzytkownik dowie sie o koniecznosci uzycia mniejszego pliku lub bezposredniego linku.
- **Jeden plik na raz**: Mega resolution wykonywany jest sekwencyjnie dla kazdego posta, wiec nie kumuluje pamieci.
- **Fallback**: Jesli Mega download sie nie powiedzie, post jest oznaczany jako `failed` ale pozostale posty kampanii kontynuuja normalna publikacje.

