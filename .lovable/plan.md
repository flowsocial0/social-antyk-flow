## Diagnoza po ultra-dokładnym sprawdzeniu

**Do I know what the issue is?** Tak.

Problem nie jest już po stronie wideo, harmonogramu ani crona. Aktualny błąd jest zwracany bezpośrednio przez API TikToka przy wywołaniu:

```text
/v2/post/publish/video/init/
```

TikTok zwraca:

```text
unaudited_client_can_only_post_to_private_accounts
```

To oznacza, że dla użytego `TIKTOK_CLIENT_KEY` TikTok nadal traktuje aplikację jako nieaudytowaną / nieuprawnioną do publicznego Direct Postingu na tym koncie. W takim stanie TikTok pozwala co najwyżej na publikację prywatną (`SELF_ONLY`), mimo że token ma scope `video.publish`.

## Co potwierdziłem

- Cron działa co minutę i podnosi posty.
- Post TikTok został znaleziony i przekazany do publikacji.
- Wideo jest obecne i pobierane poprawnie z Supabase Storage.
- Token TikToka istnieje, ma scope:

```text
user.info.basic,video.publish
```

- Token odświeża się poprawnie.
- `creator_info/query` działa i zwraca konto `Glowaccy Solutions`.
- Publikacja dochodzi aż do TikTok `video/init`, czyli backend aplikacji działa.
- Błąd pojawia się dopiero jako decyzja TikToka po stronie ich API.

## Podejrzane miejsca w kodzie

### `supabase/functions/publish-to-tiktok/index.ts`

Obecnie kod wybiera publiczną widoczność, jeśli TikTok pokazuje taką opcję:

```ts
return options.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : options[0];
```

Następnie wysyła:

```json
"privacy_level": "PUBLIC_TO_EVERYONE"
```

Dla aplikacji uznanej przez TikToka za nieaudytowaną kończy się to błędem:

```text
unaudited_client_can_only_post_to_private_accounts
```

### `supabase/functions/auto-publish-books/index.ts`

Tu błąd jest poprawnie przechwytywany i zapisany jako `failed`, dlatego użytkownik widzi go w kampanii.

## Plan naprawy

### 1. Dodać bezpieczny fallback dla TikToka

W `publish-to-tiktok` zmienić logikę tak, aby gdy TikTok zwróci:

```text
unaudited_client_can_only_post_to_private_accounts
```

funkcja automatycznie ponowiła `video/init` z:

```text
SELF_ONLY
```

Dzięki temu:

- kampania nie będzie kończyć się błędem, jeśli TikTok pozwala tylko na prywatne posty,
- zobaczymy, czy problem dotyczy wyłącznie publiczności posta,
- użytkownik dostanie realny wynik zamiast martwego błędu.

### 2. Zapisać w odpowiedzi, że post poszedł prywatnie

Jeśli fallback zadziała, funkcja ma zwrócić sukces z informacją:

```text
Post wysłany jako prywatny, ponieważ TikTok nadal nie pozwala tej aplikacji publikować publicznie dla tego konta.
```

W UI kampanii ma być widoczna informacja, że publikacja przeszła, ale z widocznością `SELF_ONLY`.

### 3. Poprawić komunikat błędu, jeśli nawet SELF_ONLY nie przejdzie

Jeśli TikTok odrzuci także `SELF_ONLY`, wtedy komunikat powinien jasno mówić:

```text
TikTok odrzuca publikację dla tej aplikacji po stronie API. To nie jest błąd harmonogramu ani wideo. Sprawdź w TikTok Developer Portal, czy Production App ma zatwierdzony Content Posting API / Direct Post dla aktualnego Client Key.
```

### 4. Dodać diagnostyczne logi bez ujawniania sekretów

W `publish-to-tiktok` dodać logi:

- czy `TIKTOK_CLIENT_KEY` jest obecny,
- skrócony fingerprint client key, np. pierwsze 4 i ostatnie 4 znaki,
- użyty `privacy_level`,
- czy publikacja była próbą publiczną czy fallbackiem prywatnym,
- dokładny `error.code` i `log_id` TikToka.

Bez logowania pełnych tokenów ani sekretów.

### 5. Dodać opcjonalne wymuszenie prywatnego testu

Dodać obsługę parametru technicznego w body funkcji:

```ts
privacyLevelOverride: 'SELF_ONLY' | 'PUBLIC_TO_EVERYONE'
```

Tylko dla diagnostyki z backendu. Pozwoli szybko sprawdzić, czy konto/aplikacja przepuszcza prywatny upload.

### 6. Zresetować obecny nieudany post do ponownej próby

Po wdrożeniu zresetować post:

```text
00591a5a-7daf-4e50-923c-752d11ff852b
```

z `failed` na `scheduled`, wyczyścić `error_message` i `error_code`, żeby cron podjął go ponownie.

### 7. Po wdrożeniu sprawdzić wynik w logach

Po kolejnej próbie sprawdzić:

- czy pierwsza próba publiczna nadal dostała `unaudited_client_can_only_post_to_private_accounts`,
- czy fallback `SELF_ONLY` przeszedł,
- czy post zmienił status na `published`,
- czy TikTok zwrócił `publish_id`.

## Ważna konkluzja

Jeżeli fallback `SELF_ONLY` przejdzie, to aplikacja technicznie działa, ale TikTok nadal nie pozwala publikować publicznie dla użytego production clienta. Wtedy problem jest w statusie zatwierdzenia TikTok Developer Portal / produkcyjnego Client Key, nie w cronach ani uploadzie.

Jeżeli fallback `SELF_ONLY` też nie przejdzie, trzeba będzie sprawdzić konfigurację aplikacji TikTok: zatwierdzony produkt Content Posting API, właściwy Production Client Key, redirect URI, scopes oraz czy aktualnie połączone konto było autoryzowane już po przejściu aplikacji na production.

<presentation-actions>
<presentation-open-history>View History</presentation-open-history>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>