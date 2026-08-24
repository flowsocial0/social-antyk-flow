# Diagnoza zużycia Supabase + naprawa wideo w kampaniach

## Co faktycznie sprawdziłem (dane z bazy, nie domysły)

- Cron `auto-publish-every-2-minutes` ma harmonogram `* * * * *` — czyli **odpala się co minutę**, nie co 2 minuty.
- W `campaign_posts` leży: 2152 `scheduled`, 1786 `paused`, 440 `failed`, 144 `rate_limited`. Każdy przebieg funkcji przemiela tę kolejkę.
- Najcięższe zapytanie w bazie to właśnie pobranie kolejki postów (JOIN `campaigns` + `books`): 31 116 wywołań, średnio 183 ms, łącznie ~95 minut czystego czasu CPU/IO. Kolejne trzy warianty tego samego zapytania to dalsze ~180 minut.
- `platform_publications` (22 568 wierszy) odpytywane 158 148 razy — brak indeksu pasującego do realnego filtra (`user_id, platform, published_at`); istniejący indeks zaczyna się od `account_id`.
- Logi funkcji: co przebieg pobierany jest ten sam film 13,2 MB z Mega.nz, wgrywany do Storage, publikacja odrzucana przez limit Facebooka, plik kasowany — i **to samo powtarza się minutę później**. Do tego regularne `CPU Time exceeded`.
- Bucket `ObrazkiKsiazek` nie ma własnego `file_size_limit`, więc obowiązuje globalny limit projektu (50 MB), a UI biblioteki obiecuje 500 MB — stąd błąd przy pliku 66,8 MB.
- Tokeny YouTube mają `refresh_token`, a pole `expires_at` to wygaśnięcie **godzinnego** tokenu dostępu, nigdy nieaktualizowane po odświeżeniu.
- W kreatorze prostym każdy post wgrywa swój plik osobno, a do bazy zapisywane jest tylko jedno pole: `custom_image_url: post.imageUrl || post.videoUrl`.

## Odpowiedzi na pytania

**Punkt 5 — mail od Supabase:** to nie jest ogólna wysyłka, to alert konkretnie o tym projekcie i trzeba zareagować. Przyczyna jest widoczna w danych powyżej: pętla co minuty po kilkutysięcznej kolejce postów plus powtarzane pobieranie tych samych filmów.

**Punkt 3 — „Wygasa za 1 dzień” na YouTube:** to fałszywy alarm w UI. Pokazujemy datę wygaśnięcia tokenu dostępu (ważny 1 godzinę, odświeżany automatycznie), a nie realny stan połączenia. Połączenie jest sprawne, dopóki jest `refresh_token`.

**Punkt 2 — film nie wgrywa się do biblioteki:** problem nadal występuje i nie jest losowy. Plik 66,8 MB przekracza limit rozmiaru obiektu w Storage, a formularz deklaruje 500 MB, więc upload kończy się błędem serwera bez czytelnego komunikatu.

**Punkt 4 — wideo znika po utworzeniu kampanii:** ten sam plik jest wgrywany od nowa dla każdego z 7 dni (stąd bardzo długie „pobieranie”), a przy zapisie posta wideo jest nadpisywane przez grafikę — do bazy trafia tylko jedno z dwóch pól. Dlatego po utworzeniu każdy dzień pokazuje „Dodaj wideo”.

## Plan naprawy

### A. Zużycie bazy (priorytet)

1. Cron `auto-publish-books` z `* * * * *` na `*/3 * * * *`.
2. Zapytanie kolejki: wykluczyć statusy końcowe (`paused`, `published`) po stronie SQL, pobierać tylko potrzebne kolumny zamiast `campaign_posts.*` + zagnieżdżonych JOIN-ów, twardy limit partii.
3. Indeksy: częściowy indeks na `campaign_posts (scheduled_at)` dla statusów aktywnych oraz indeks `platform_publications (user_id, platform, published_at DESC)`.
4. Backoff dla powtarzalnych porażek: post, który dostał limit platformy, dostaje `next_retry_at` i nie jest podnoszony w każdym przebiegu.
5. **Rozwiązanie pobierania z Mega przed sprawdzeniem limitów** — najpierw walidacja konta i limitów platformy, dopiero potem pobranie pliku. Dziś 13 MB transferu ginie przy każdej odrzuconej próbie.
6. Jednorazowe porządki: posty `failed`/`rate_limited` starsze niż X dni przechodzą w stan końcowy, żeby nie krążyły w kolejce.

### B. Upload wideo do biblioteki

7. Ustawić realny `file_size_limit` na buckecie i zsynchronizować `MAX_UPLOAD_MB` z tą wartością.
8. Czytelny komunikat przed wysyłką: „Plik ma X MB, limit to Y MB — wrzuć na Mega.nz i dodaj jako link”, zamiast błędu z API.

### C. Wideo w kreatorze kampanii

9. Rozdzielić media posta: osobne pole na wideo obok `custom_image_url`, żeby grafika i film mogły współistnieć.
10. Ten sam plik wybrany dla wielu dni wgrywany **raz** i współdzielony przez posty (deduplikacja po nazwie i rozmiarze).
11. Podgląd posta w szczegółach kampanii ma rozpoznawać przypisane wideo i pokazywać „Zmień wideo” zamiast „Dodaj wideo”.

### D. Status połączeń

12. W `PlatformConnectionStatus.tsx` nie liczyć „wygasa za N dni” z tokenu dostępu. Gdy jest `refresh_token` — „Połączono”; ostrzeżenie tylko, gdy odświeżenie faktycznie zawiodło.

## Szczegóły techniczne

- Migracje: nowe indeksy, kolumna wideo w `campaign_posts`, jednorazowy update starych statusów.
- Zmiana crona przez `run_sql` (zawiera klucz projektu, nie trafia do migracji).
- Pliki: `supabase/functions/auto-publish-books/index.ts`, `src/components/campaigns/SimpleCampaignSetup.tsx`, `src/components/campaigns/CampaignSetup.tsx`, `src/components/campaigns/CampaignPostCard.tsx`, `src/lib/videoLibrary.ts`, `src/components/videos/AddVideoDialog.tsx`, `src/components/platforms/PlatformConnectionStatus.tsx`.
- Limit rozmiaru obiektu w Storage ustawiany narzędziem konfiguracji bucketu.
