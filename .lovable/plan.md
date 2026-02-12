
# Integracja Mega.nz w masowym uploadzie wideo

## Opis

Dodanie czwartej zakladki "Mega.nz" w dialogu masowego uploadu wideo. Uzytkownik wkleja linki Mega.nz, system pobiera pliki w przegladarce uzywajac biblioteki `megajs`, a nastepnie uploaduje je do Supabase Storage.

## Flow uzytkownika

1. Uzytkownik otwiera dialog masowego wideo i wybiera zakladke "Mega.nz"
2. Wkleja linki Mega.nz (jeden na linie)
3. System waliduje linki (czy pasuja do formatu `mega.nz/file/...`)
4. Klikniecie "Dalej" - system laczy sie z Mega i pobiera nazwy plikow (loadAttributes)
5. Dopasowanie do ksiazek (LCS fuzzy matching) - tak jak w zakladce URL
6. Podglad dopasowan (krok 2) z mozliwoscia korekty
7. Klikniecie "Pobierz i przeslij" - dla kazdego pliku:
   - Pobranie z Mega (deszyfrowanie w przegladarce)
   - Upload do Supabase Storage (bucket ObrazkiKsiazek)
   - Aktualizacja `video_url` i `video_storage_path` w bazie
8. Progress bar pokazujacy aktualny plik i postep

## Zakres zmian technicznych

| Plik | Zmiana |
|------|--------|
| `package.json` | Dodanie zaleznosci `megajs` |
| `src/components/books/bulk-video/MegaLinksTab.tsx` | Nowy komponent - textarea na linki Mega, walidacja, pobieranie nazw plikow, matching |
| `src/components/books/bulk-video/utils.ts` | Dodanie funkcji `isMegaUrl()` do walidacji linkow Mega |
| `src/components/books/bulk-video/types.ts` | Rozszerzenie `FileMatch` o pole `megaFile` (referencja do obiektu megajs File) |
| `src/components/books/BulkVideoUploadDialog.tsx` | Dodanie czwartej zakladki "Mega.nz", obsluga trybu "mega" w `startSave` (pobieranie + upload) |

## Szczegoly techniczne

### Import megajs w przegladarce

```typescript
import { File as MegaFile } from 'megajs';

const file = MegaFile.fromURL('https://mega.nz/file/xxx#yyy');
await file.loadAttributes(); // pobiera nazwe, rozmiar
const buffer = await file.downloadBuffer(); // pobiera i deszyfruje
const blob = new Blob([buffer], { type: 'video/mp4' });
```

### Flow zapisu (tryb mega)

Dla kazdego dopasowanego pliku kolejno:
1. `file.downloadBuffer()` - pobranie z Mega do pamieci
2. `supabase.storage.from('ObrazkiKsiazek').upload(path, blob)` - upload do Storage
3. `supabase.from('books').update({ video_storage_path, video_url })` - zapis w bazie

### Progress

Dwupoziomowy progress:
- Ktory plik z kolei (np. "3/10")
- Dla kazdego pliku: faza "Pobieranie z Mega..." / "Przesylanie do Storage..."

### Walidacja linkow Mega

```typescript
function isMegaUrl(url: string): boolean {
  return /^https?:\/\/mega\.nz\/(file|folder)\//.test(url);
}
```

### Ograniczenia i ostrzezenia w UI

- Informacja ze duze pliki moga zajac duzo pamieci RAM
- Ostrzezenie jesli laczny rozmiar plikow przekracza np. 1GB
- Mozliwosc anulowania w trakcie

### Obsluga bledow

- Nieprawidlowy link Mega (brak klucza deszyfrujacego)
- Plik usuniety z Mega
- Przekroczenie limitu pamieci przegladarki
- Blad uploadu do Storage
