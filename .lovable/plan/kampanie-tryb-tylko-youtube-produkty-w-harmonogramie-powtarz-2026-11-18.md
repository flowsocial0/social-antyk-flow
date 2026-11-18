# Kampanie: tryb „tylko YouTube”, produkty w harmonogramie, powtarzanie postów, błąd YouTube

## 1. Tryb zaawansowany — tylko YouTube bez książek i bez AI
- Gdy jedyną platformą jest YouTube i wyłączone są wszystkie opcje generowania (AI, ciekawostki, nowe teksty), wybór książki przestaje być wymagany.
- Pojawia się sekcja „Filmy do kampanii”: wybór jednego lub kilku filmów z biblioteki oraz pole „Ile razy powtórzyć”.
- Kampania tworzy posty wyłącznie z tych filmów, powtarzanych zadaną liczbę razy i rozłożonych według dni i godzin. Nic nie jest generowane przez AI.
- Tytuł, opis, tagi i miniaturka pochodzą z ustawień YouTube kampanii (gdy puste — z tytułu filmu w bibliotece).

## 2. „Dodaj post” w zaplanowanym harmonogramie
- W oknie dodawania posta (szczegóły kampanii) dochodzi wybór produktu/książki z listy.
- Gdy kampania publikuje na YouTube, lista pokazuje tylko produkty z przypisanym wideo, a film z produktu staje się wideo posta.
- Grafika produktu (zdjęcie statyczne) jest automatycznie ustawiana jako miniaturka YouTube; można ją podmienić.

## 3. Tryb prosty — powtarzanie posta
- Nowe opcje przy poście: „Powtarzaj X razy dziennie” (z wyborem godzin) oraz „przez Y dni”.
- Przed zapisem widać podgląd: ile publikacji powstanie i w jakich terminach.

## 4. Tylko YouTube = brak generowania tekstów
- Gdy jedyną platformą jest YouTube, w obu trybach pomijamy generowanie tekstów postów przez AI (oszczędność czasu i kosztów). Liczy się tylko wideo (własne lub z książki) i metadane YouTube.
- Ukrywamy opcje AI/ciekawostek, które w tym przypadku nie mają sensu, z krótką informacją dlaczego.

## 5. Błąd publikacji YouTube (diagnoza z bazy)
Obecne błędy kampanii YouTube to „Token YouTube wygasł” dla konta 18f9f964 (token wygasł 5 listopada, odświeżenie się nie udaje). Znalezione przyczyny w kodzie:
- Po odświeżeniu tokena zapis nadpisuje token **wszystkich** kont YouTube użytkownika (filtr po użytkowniku, nie po koncie) — przy kilku kanałach psuje to pozostałe konta. Poprawka: zapis tylko dla konkretnego konta.
- Gdy Google odrzuca odświeżenie (konto odłączone lub aplikacja Google w trybie testowym, gdzie dostęp wygasa po 7 dniach), post jest ponawiany 3 razy na próżno. Poprawka: rozpoznać ten przypadek, od razu oznaczyć konto „wymaga ponownego połączenia” i nie ponawiać.
- Sprawdzę też komunikaty limitu dziennego YouTube (quota) i ustawię ponowienie dopiero po północy czasu pacyficznego zamiast co kilka minut.
- Do zrobienia przez Ciebie: ponownie połączyć to konto YouTube w Ustawieniach. Jeśli aplikacja Google jest w trybie „Testing”, przełączyć ją na „In production”, inaczej problem będzie wracał co tydzień.

## Szczegóły techniczne
- `CampaignSetup.tsx`: flaga `youtubeOnly = targetPlatforms == ['youtube']`; `canSubmit` dopuszcza `videoOnlyItems` zamiast `selectedBooks`; nowe pola configu `videoItems[{videoId}]`, `repeatCount`.
- Generator kampanii (`CampaignBuilder` / funkcja generowania): przy `youtubeOnly` budowa postów bez wywołań AI, `text` = tytuł YouTube, `custom_video_url` = film, `youtube_thumbnail_url` z ustawień lub grafiki książki.
- `CampaignDetails.tsx` dialog dodawania posta: `BookSelector` (single, `requireVideo` gdy YouTube), ustawianie `book_id`, `custom_video_url`, `youtube_thumbnail_url = books.image_url`.
- `SimpleCampaignSetup.tsx`: pola `timesPerDay`, `times[]`, `repeatDays`; rozwinięcie posta na N×Y rekordów `campaign_posts` z tym samym wideo i deduplikacją.
- `publish-to-youtube`: update tokena `.eq('id', tokenData.id)`; obsługa `invalid_grant` → kod `YOUTUBE_REAUTH_REQUIRED`; `quotaExceeded` → `next_retry_at` = najbliższa północ PT. `auto-publish-books`: te kody kończą post jako `failed` bez 3 prób (reauth) lub `rate_limited` do resetu (quota).
- Testy: jednostkowe dla rozwijania powtórzeń (X/dzień × Y dni = poprawna liczba terminów) i dla reguły „tylko YouTube nie wymaga książki”.
