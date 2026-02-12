
# Masowy upload filmow do ksiazek

## Problem
Ponad 100 filmow na dysku, nazwanych tytulami ksiazek (np. "W obronie wiary katolickiej.mp4"). Trzeba je masowo wrzucic i automatycznie dopasowac do ksiazek w bazie.

## Rozwiazanie

Nowy komponent **BulkVideoUploadDialog** dostepny z listy ksiazek, ktory:

1. Uzytkownik wybiera wiele plikow wideo naraz (input multiple)
2. System automatycznie dopasowuje nazwy plikow do tytulow ksiazek (fuzzy matching)
3. Uzytkownik widzi podglad dopasowan i moze recznie poprawic
4. Upload przebiega partiami z paskiem postepu

## Architektura

### Frontend: `src/components/books/BulkVideoUploadDialog.tsx`

Nowy komponent z trzema krokami:

**Krok 1 - Wybor plikow**
- Input type="file" z atrybutem `multiple` i `accept="video/*"`
- Wyswietlenie liczby wybranych plikow i ich lacznego rozmiaru

**Krok 2 - Podglad dopasowan**
- Tabela z kolumnami: Nazwa pliku | Dopasowana ksiazka | Zgodnosc (%) | Akcja
- Algorytm dopasowania: normalizacja nazw (usun rozszerzenie, podkreslniki na spacje, lowercase) i porownanie z tytulami ksiazek
- Trzy stany dopasowania:
  - Zielony: znaleziono dopasowanie powyzej 70%
  - Zolty: czesciowe dopasowanie 40-70% - uzytkownik moze potwierdzic lub zmienic
  - Czerwony: brak dopasowania - uzytkownik moze recznie wybrac ksiazke z listy (select/combobox)
- Statystyki: "Dopasowano: X / Czesciowo: Y / Niedopasowano: Z"

**Krok 3 - Upload z postepem**
- Sekwencyjny upload plikow (po jednym, zeby nie przeciazyc)
- Progress bar z informacja: "Przesylanie 15/120 - Patriotyzm, mestwo, prawosc zolnierska.mp4"
- Po uplaodzie kazdego pliku: aktualizacja `video_storage_path` i `video_url` w tabeli books
- Podsumowanie na koncu: ile sukces, ile bledow

### Algorytm dopasowania nazw plikow do tytulow

```text
1. Z nazwy pliku: usun rozszerzenie (.mp4, .mov, .webm)
2. Zamien podkreslniki i myslniki na spacje
3. Lowercase + trim
4. Dla kazdej ksiazki: porownaj z lowercase tytulu
5. Metryka: najdluzsza wspolna podsekwencja (LCS) / max(dlugosc nazwy, dlugosc tytulu)
6. Wybierz najlepsze dopasowanie powyzej progu 40%
```

### Integracja

- Nowy przycisk "Masowy upload wideo" w BooksList.tsx (obok istniejacych przyciskow)
- Upload do bucketu `ObrazkiKsiazek` pod sciezka `videos/{book_id}.{ext}`
- Aktualizacja pol `video_storage_path` i `video_url` (public URL) w tabeli books

## Zakres zmian

| Plik | Zmiana |
|------|--------|
| `src/components/books/BulkVideoUploadDialog.tsx` | NOWY - caly komponent |
| `src/components/books/BooksList.tsx` | Dodanie przycisku i importu dialogu |

## Uwagi techniczne

- Pliki wideo sa duze (nawet 100MB+), wiec upload sekwencyjny, nie rownolegle
- Supabase Storage obsluguje pliki do 5GB per upload
- Kazdy plik uploadowany bezposrednio z przegladarki do Supabase Storage (bez edge function)
- Fuzzy matching dziala calkowicie po stronie frontendu - lista ksiazek jest pobierana raz
- Limit 20MB na plik w Lovable nie dotyczy - upload idzie bezposrednio do Supabase Storage API
