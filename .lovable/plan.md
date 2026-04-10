
Co ustaliłem:
- To nie wygląda na globalny brak publikacji „od 3 kwietnia”. W danych `platform_publications` dla tego użytkownika widać realne publikacje:
  - X: do 2026-04-07 21:00 UTC, 40 publikacji
  - Facebook: do 2026-04-07 21:00 UTC, 152 publikacje
  - Instagram: 3 publikacje 2026-04-03
- Problem dotyczy głównie konkretnych kampanii po ponownym podłączeniu kont społecznościowych 2026-04-08.

Główna przyczyna:
- Kampanie zapisują konta na sztywno przez UUID w:
  - `campaigns.selected_accounts`
  - `campaign_posts.target_accounts`
- Po ponownym połączeniu kont 8 kwietnia utworzyły się nowe rekordy tokenów z nowymi ID.
- Stare kampanie nadal wskazują stare, już nieistniejące ID, więc auto-publish kończy się błędem:
  `Konto nie istnieje. Połącz ponownie w ustawieniach.`

Najmocniejszy dowód:
- Kampania `x oraz Instagram Facebook Linkedin 1,5 % na rzecz RKW` nadal celuje w stare ID:
  - X `22daa0ba-...`
  - Instagram `ca626cbc-...`
  - LinkedIn `ada9478d-...`
  - Facebook `ea5e3da9-...`, `e943cb0b-...`, `4e4847a5-...`, `2c3bdbdb-...`
- Tymczasem aktualnie podłączone konta mają już inne ID:
  - X `82fc46ce-...`
  - Instagram `eeea0325-...`
  - LinkedIn `b4e0c988-...`
  - Facebook nowe ID z 2026-04-08

Dodatkowe ustalenia:
- Część kampanii ma status `paused`, więc one i tak nie będą publikować, dopóki nie zostaną wznowione.
- Osobno istnieje też kampania YouTube, która pada na wygasłym tokenie:
  `Token YouTube wygasł. Połącz konto ponownie.`
- Czyli to nie jest jeden wspólny problem silnika publikacji, tylko głównie:
  1. stare ID kont po reconnect,
  2. część kampanii w `paused`,
  3. pojedyncze osobne problemy z tokenami.

Plan naprawy:
1. Dodać automatyczne wykrywanie „osieroconych” kont w `auto-publish-books`
   - jeśli `target_accounts` wskazuje nieistniejące konto, system ma rozpoznać to jako stale reference zamiast zwykłego `PUBLISH_FAILED`
2. Dodać automatyczne przepinanie na aktualne konto użytkownika
   - X po `screen_name`
   - Instagram po `instagram_username` / `account_name`
   - LinkedIn po `display_name` / `account_name`
   - Facebook po `page_name`
3. Przygotować jednorazową naprawę istniejących danych kampanii
   - zaktualizować `campaigns.selected_accounts`
   - zaktualizować `campaign_posts.target_accounts`
   - tylko tam, gdzie stare ID już nie istnieją
4. Poprawić UI kampanii
   - wyraźny komunikat: „Kampania wskazuje stare konto po ponownym połączeniu”
   - akcja typu „Odśwież konta w kampanii”
5. Poprawić `ResumeCampaignDialog`
   - teraz kopiuje stare `selected_accounts` / `target_accounts` 1:1, więc może utrwalać problem po reconnect

Pliki do zmiany:
- `supabase/functions/auto-publish-books/index.ts`
- `src/pages/CampaignDetails.tsx`
- `src/components/campaigns/ResumeCampaignDialog.tsx`

Najważniejszy wniosek:
- Problem nie polega na tym, że cały system publikacji przestał działać po 3 kwietnia.
- Problem polega na tym, że po ponownym podłączeniu kont stare kampanie nadal próbują publikować na nieistniejące rekordy kont, więc automatyczna publikacja z tych kampanii jest skazana na błąd mimo tego, że nowe konta są już poprawnie podłączone.
