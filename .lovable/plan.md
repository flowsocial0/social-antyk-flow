
Diagnoza po kodzie, bazie i zgłoszeniach pokazuje, że to nie jest jeden problem, tylko kilka nakładających się awarii:

1. Prawdziwe źródła problemu
- X: użytkownik nie ma już żadnego rekordu w `twitter_oauth1_tokens`, więc kampanie wskazujące stare konto X nie mają z czego publikować. Dodatkowo w historii są błędy `15/15 dzienny limit` oraz `402 CreditsDepleted`, więc nawet po naprawie połączenia trzeba obsłużyć też limity/kredyty X.
- Facebook: większość konkretnych stron używanych w kampaniach ma wygasłe tokeny (5 z 6 rekordów wygasło 2026-03-29). Test połączenia świeci na zielono, bo sprawdza tylko jedno domyślne konto, a kampanie publikują na konkretnych `target_accounts`. Jedno ważne konto zwraca też Facebookowy checkpoint: „Confirm your identity before you can publish as this Page”.
- Instagram: token jest ważny; główne błędy to antyspam (`User is performing too many actions`), `Invalid parameter` oraz posty bez media.
- LinkedIn: token jest ważny i świeży, ale publikacje wpadały w dzienny throttle (`APPLICATION_AND_MEMBER DAY`). Screenshot z `social-auto-flow.netlify.app` wskazuje nie na kod w repo, tylko na złą runtime konfigurację redirectu (`FRONTEND_URL`/ustawienia appki LinkedIn).
- Auto-publish nadal źle klasyfikuje błędy: wiele tymczasowych limitów kończy jako `failed`, bo kod rozpoznaje za mało wzorców i potrafi nadpisać status `rate_limited` ustawiony niżej przez platformową edge function.
- UI wprowadza użytkownika w błąd: „Aktywna” oznacza obsługiwaną platformę, nie realne połączenie konta; „Test połączenia” daje false positive, bo nie sprawdza właściwego konta ani realnej możliwości publikacji.

2. Co trzeba naprawić w kodzie
- Ujednolicić obsługę OAuth redirectów:
  - poprawić wszystkie callbacki Facebook/Instagram/LinkedIn, aby używały jednego helpera do wyliczania frontendu,
  - usunąć zależność od starego netlify w runtime,
  - ustawić spójny redirect zawsze na `socialautoflow.pl`.
- Naprawić logikę `auto-publish-books`:
  - nie nadpisywać `rate_limited` na `failed`,
  - rozpoznawać także: `DAILY_LIMIT`, `X_API_DAILY_LIMIT`, `CreditsDepleted`, `too many actions`, `APPLICATION_AND_MEMBER DAY`, polski antyspam Facebooka,
  - dla limitów ustawiać `rate_limited + next_retry_at`, a nie `failed`.
- Dodać walidację kont przed publikacją:
  - sprawdzić, czy każdy `target_account` istnieje,
  - czy token nie wygasł,
  - czy konto nadal ma wymagane pola/uprawnienia.
- Naprawić model wskazywania kont w kampaniach:
  - dziś kampanie zapisują wewnętrzne ID rekordów tokenów; po rozłączeniu i ponownym połączeniu te ID się zmieniają i kampanie się „odklejają” od kont,
  - trzeba przejść na stabilne identyfikatory z platform (`page_id`, `instagram_account_id`, `linkedin_id`, `x_user_id`) albo wprowadzić osobną trwałą tabelę `social_accounts`.
- Naprawić testy połączeń:
  - Facebook/Instagram/LinkedIn/X muszą testować każde konto osobno,
  - test ma zwracać stan typu: `ok`, `expired`, `checkpoint`, `missing_write_scope`, `rate_limited`, `credits_depleted`,
  - UI ma pokazywać stan per konto, nie tylko ogólne zielone „połączono”.
- Naprawić UX zarządzania kontami:
  - dodać przycisk „Połącz ponownie / Odśwież uprawnienia”,
  - pokazać datę wygaśnięcia tokenu i status zdrowia dla każdego konta,
  - zmienić etykietę „Aktywna” na coś w stylu „Obsługiwana platforma”, żeby nie mylić z realnym połączeniem.

3. Platformy: konkretne poprawki
- X:
  - zostajemy wyłącznie przy OAuth 1.0a,
  - poprawić reconnect po rozłączeniu,
  - jasno rozdzielić błędy: brak konta, brak write access, dzienny limit, `CreditsDepleted`.
- Facebook:
  - wykrywać wygasłe tokeny per strona,
  - osobno komunikować Facebook checkpoint „Confirm your identity...”,
  - nie uznawać testu za sukces, jeśli tylko jedno domyślne konto działa.
- Instagram:
  - dodać preflight: bez obrazu/wideo nie wolno planować publikacji,
  - poprawić walidację URL media,
  - dla antyspamu dawać retry z bezpiecznym backoffem.
- LinkedIn:
  - naprawić redirect runtime/config,
  - throttle klasyfikować jako tymczasowy limit z retry, nie awarię tokenu.

4. Plan wdrożenia
- Etap 1: naprawa redirectów i runtime config dla OAuth.
- Etap 2: naprawa `auto-publish-books` i klasyfikacji błędów tymczasowych vs trwałych.
- Etap 3: walidacja `target_accounts` oraz migracja na stabilne identyfikatory kont.
- Etap 4: per-account health checks + prawdziwy „Test połączenia”.
- Etap 5: UI kont społecznościowych z jasnym stanem wygasłych/odłączonych/problemowych kont.
- Etap 6: narzędzie naprawcze do masowego wznowienia kampanii 1,5% po odświeżeniu połączeń.

5. Co to da dla kampanii 1,5%
- Facebookowe kampanie przestaną próbować publikować na martwych rekordach tokenów.
- LinkedIn nie będzie wpadał w „failed” przy chwilowym throttle.
- Instagram będzie bezpiecznie odraczany zamiast psuć kampanię.
- X przestanie udawać, że „coś jest podłączone”, gdy nie ma tokenu lub skończyły się kredyty.
- Po odświeżeniu kont będzie można bezpiecznie wznowić krytyczne posty 1,5% bez ponownego zalania platform.

Najważniejsze: wczorajsza poprawka limitów nie trafiła w główny problem. Główne źródła to: martwe/stare powiązania kont w kampaniach, wygasłe tokeny Facebooka, brak tokenu X, zły runtime redirect dla LinkedIn oraz fałszywie uspokajający „test połączenia”. Prawdziwie wartościowe rozwiązanie musi naprawić wszystkie te warstwy razem, a nie tylko throttling.