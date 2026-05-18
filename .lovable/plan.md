## Plan: Porządki w kampaniach X + nowy widok listy/filtry w Kampaniach AI

### Część 1 — Dokończenie sprzątania po błędach X (402 CreditsDepleted)

W poprzednim kroku dodano obsługę `X_CREDITS_DEPLETED`, ale zostały stare dane w bazie. Teraz wykonujemy jednorazową migrację danych:

1. **Backfill 56 starych błędów** w kampanii `dfd66aac-14b1-44cc-abc7-d49a45604664`:
   - Wszystkie posty X ze statusem `failed` + `error_code = 'unknown'` + `error_message` zawierającym `CreditsDepleted` / `402` → ustawić `error_code = 'X_CREDITS_DEPLETED'`, wyczyścić `next_retry_at`.
2. **Wstrzymanie 304 oczekujących postów X** w tej kampanii:
   - Posty X ze statusem `scheduled` → zmiana statusu na `paused` (lub `failed` z `error_code='X_CREDITS_DEPLETED'`) żeby nie szły do kolejki publikacji.
   - Po doładowaniu konta X użytkownik kliknie "Wznów" w widoku kampanii.

(Operacja wykonana przez `supabase--read_query`/`insert` po Twojej zgodzie — nie ruszamy struktury bazy.)

---

### Część 2 — Nowa nawigacja w `/campaigns` (CampaignsList)

Strona dostaje jeden zestaw kontrolek u góry:

```
┌─────────────────────────────────────────────────────────────────┐
│ [🔍 Szukaj kampanii...]  [Status ▾] [Sortuj ▾]   [▦ Karty] [☰ Lista] │
├─────────────────────────────────────────────────────────────────┤
│ Foldery platform (poziome chipsy z licznikiem):                 │
│ [Wszystkie 42] [𝕏 X 18] [📘 Facebook 9] [📸 IG 7] [▶ YT 3] ... │
└─────────────────────────────────────────────────────────────────┘
```

#### 2a. Foldery po platformach
- Chipsy/zakładki z platform (X, Facebook, Instagram, YouTube, LinkedIn, TikTok + pozostałe) wygenerowane z `campaigns.target_platforms` / `selected_accounts`.
- Każdy chip pokazuje liczbę kampanii dla tej platformy.
- Kampania pojawia się w każdym folderze platformy, którą ma w celach (multi-platform → wiele folderów).
- Domyślnie „Wszystkie".

#### 2b. Wyszukiwarka
- Pole tekstowe — filtruje po `name` i `description` (case-insensitive, lokalnie, bo lista już w pamięci).

#### 2c. Filtr statusu
- Dropdown: Wszystkie / Szkic / Zaplanowana / Aktywna / Zakończona / Anulowana.

#### 2d. Przełącznik widoku Karty ⇄ Lista (toggle, zapisany w `localStorage`)

**Widok Karty** — bez zmian względem obecnego.

**Widok Lista** — sortowalna tabela (`@/components/ui/table`) z kolumnami:

| Kolumna | Sortowalna | Źródło |
|---|---|---|
| Tytuł | ✓ | `name` |
| Status | ✓ | `status` (badge) |
| Platformy | – | ikony z `selected_accounts` |
| Data startu | ✓ | `start_date` |
| Czas trwania | ✓ | `duration_days` |
| Posty (opublikowane / łącznie) | ✓ | `published_posts` / `total_posts` |
| Postęp | – | mini progress bar |
| Utworzono | ✓ | `created_at` |

- Klik w nagłówek kolumny → sortuje rosnąco/malejąco (strzałka ▲▼).
- Klik w wiersz → przejście do `/campaigns/:id` (jak teraz w karcie).
- Sortowanie też dostępne jako dropdown „Sortuj" w widoku Karty.

#### 2e. UX
- Preferencje (widok karty/lista, ostatnio wybrany folder, sortowanie) zapamiętane w `localStorage` pod kluczem `campaigns:view-prefs`.
- Pusty wynik filtrowania → komunikat „Brak kampanii pasujących do filtrów" + przycisk „Wyczyść filtry".
- Responsywność: na mobile lista przechodzi w kompaktową kartę-wiersz (ukrywamy mniej istotne kolumny).

---

### Pliki do zmiany

| Plik | Zmiana |
|---|---|
| `src/components/campaigns/CampaignsList.tsx` | Refaktor: dodać stan filtrów/sortowania/widoku, podzielić render na `CampaignsGrid` i `CampaignsTable`. |
| `src/components/campaigns/CampaignsGrid.tsx` *(nowy)* | Wyciągnięty obecny widok kart. |
| `src/components/campaigns/CampaignsTable.tsx` *(nowy)* | Tabela z sortowaniem. |
| `src/components/campaigns/CampaignsToolbar.tsx` *(nowy)* | Search + filtry + toggle widoku + foldery platform. |
| (opcjonalnie) `src/hooks/useCampaignsViewPrefs.ts` | Hook do `localStorage`. |

**Brak zmian schematu DB.** Brak nowych edge functions.

### Test plan
1. `/campaigns` → widać chipsy platform z licznikami; klik w „X" pokazuje tylko kampanie z X.
2. Search „test" filtruje listę na bieżąco; działa razem z folderem.
3. Toggle „Lista" → tabela z sortowalnymi kolumnami; klik „Data startu" sortuje, drugi klik odwraca kierunek.
4. Odświeżenie strony → ostatnio wybrany widok/folder/sort przywrócone.
5. Kampania `dfd66aac…` → 56 błędów ma `X_CREDITS_DEPLETED`, 304 scheduled posty już nie próbują się publikować.
