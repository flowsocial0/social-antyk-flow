

# Rozszerzenie dialogu masowego wideo o trzy tryby

## Obecny stan

Dialog `BulkVideoUploadDialog` ma jeden tryb: upload plikow z dysku z automatycznym dopasowaniem do ksiazek.

## Plan zmian

Dialog dostanie trzy zakladki (Tabs) w kroku 1:

### Zakladka 1: "Upload plikow" (istniejaca)
Bez zmian - wybor plikow z dysku, fuzzy matching, upload do Supabase Storage.

### Zakladka 2: "Linki URL" (nowa)
1. Textarea na wklejenie listy bezposrednich linkow (jeden na linie)
2. System wyciaga nazwe pliku z URL-a i dopasowuje do ksiazek (LCS)
3. Podglad dopasowan z mozliwoscia recznej korekty (krok 2)
4. Zapis: aktualizacja tylko pola `video_url` (bez uploadu)

### Zakladka 3: "Przypisz linki recznie" (nowa)
Ta zakladka rozwiazuje problem linkow z nic niemowiacymi nazwami (np. `https://cdn.example.com/abc123xyz.mp4`).

Jak dziala:
1. Wyswietla liste WSZYSTKICH ksiazek z bazy w tabeli
2. Kazda ksiazka ma pole tekstowe (input) obok tytulu
3. Uzytkownik po prostu wkleja link do wideo przy odpowiedniej ksiazce
4. Opcjonalne: filtrowanie/wyszukiwanie ksiazek po tytule (zeby szybko znalezc wlasciwa)
5. Opcjonalne: pokazanie ikony czy ksiazka juz ma przypisane wideo
6. Przycisk "Zapisz" aktualizuje pole `video_url` dla wszystkich ksiazek ktore dostaly nowy link

Interfejs zakladki 3 (schemat):

```text
[Szukaj ksiazki...                    ]

| Tytul ksiazki              | Obecne wideo | Link do wideo              |
|----------------------------|--------------|----------------------------|
| Ogniem i Mieczem           | (brak)       | [wklej link tutaj...     ] |
| Pan Tadeusz                | (jest)       | [wklej link tutaj...     ] |
| Quo Vadis                  | (brak)       | [wklej link tutaj...     ] |

                                    [Zapisz X zmian]
```

## Wspolny flow

- Zakladki 2 i 3 NIE przechodza przez krok 3 (progress bar uploadu) - zapis jest natychmiastowy (tylko UPDATE w bazie)
- Zakladka 1 zachowuje dotychczasowy 3-krokowy flow z progress barem

## Zakres zmian

| Plik | Zmiana |
|------|--------|
| `src/components/books/BulkVideoUploadDialog.tsx` | Dodanie Tabs z trzema trybami, textarea dla linkow URL, lista ksiazek z inputami dla recznego przypisywania |

## Szczegoly techniczne

- Zakladka 3 uzywa tego samego query `all-books-for-matching` co juz istnieje w komponencie
- Dodanie pola wyszukiwania (filtr po tytule) dla wygody przy duzej liczbie ksiazek
- Stan zmian w zakladce 3: `Record<string, string>` (bookId -> url) - zapisywane sa tylko te ksiazki ktore dostaly nowy link
- Przycisk "Zapisz" robi batch update - dla kazdej zmienionej ksiazki osobny `supabase.from('books').update({ video_url }).eq('id', bookId)`
- Ikona obok tytulu pokazuje czy ksiazka juz ma wideo (zielona kropka lub szara)
- Walidacja: sprawdzenie czy wklejony link zaczyna sie od `http://` lub `https://`
