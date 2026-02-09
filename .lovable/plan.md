
# Fix: Instagram nie publikuje okładek z kampanii

## Problem

Znalazłem dwa oddzielne problemy:

### Problem 1: "Fałszowanie historii najnowszej Ukrainy" - Instagram nie widzi okładki
- Książka MA okładkę w Supabase Storage (`books/6dc836fa-...jpg`) ORAZ zewnętrzny `image_url` (`https://sklep.antyk.org.pl/img/...`)
- Funkcja `auto-publish-books` wysyła do Instagrama **zewnętrzny URL** ze sklepu, a nie URL z Supabase Storage
- Serwery Instagrama nie mogą pobrać obrazu z domeny `sklep.antyk.org.pl` (prawdopodobnie blokada hotlinkowania lub problem z SSL)
- Dlatego X publikuje normalnie (pobiera obraz sam), a Instagram zwraca "Media ID is not available"

### Problem 2: "Mediugorie. Prawda czy fałsz?" - brak okładki w bazie
- Ta książka ma **puste** pola `image_url` i `storage_path` w bazie danych
- Nie ma też żadnego pliku w storage Supabase
- Instagram wymaga obrazu - nie obsługuje postów tekstowych
- Trzeba dodać okładkę do tej książki (ręcznie w ustawieniach książki)

## Rozwiązanie

### Zmiana w `auto-publish-books/index.ts`

Zmienić logikę rozwiązywania mediów (linia ~442), aby **preferowała Supabase Storage** nad zewnętrznym URL:

```
// Obecna logika (błędna):
const mediaUrl = post.custom_image_url || post.book?.image_url || null;

// Nowa logika (poprawna):
const storageUrl = post.book?.storage_path 
  ? `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${post.book.storage_path}` 
  : null;
const mediaUrl = post.custom_image_url || storageUrl || post.book?.image_url || null;
```

To zapewni, że Instagram dostanie URL z Supabase Storage (który jest publicznie dostępny), a nie zewnętrzny URL ze sklepu.

### Zmiana w `publish-to-instagram/index.ts`

Dodać analogiczną logikę fallback wewnątrz samej funkcji Instagram - gdy pobiera książkę z bazy, powinna preferować `storage_path` nad `image_url`.

### Co z "Mediugorie"?

Dla tej książki trzeba ręcznie dodać okładkę w panelu zarządzania książkami. Brak obrazu to nie bug w kodzie - książka po prostu nie ma przypisanej okładki.

## Szczegóły techniczne

Pliki do zmiany:
1. `supabase/functions/auto-publish-books/index.ts` - dodanie `storage_path` do interfejsu `Book`, query do bazy i logiki rozwiązywania mediów
2. `supabase/functions/publish-to-instagram/index.ts` - zmiana kolejności priorytetów mediów: storage_path przed image_url

Po zmianach: re-deploy obu Edge Functions.
