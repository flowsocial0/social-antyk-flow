## TikTok — poprawki UX pod ponowną aplikację (Content Sharing Guidelines pkt 3 i 4)

### Diagnoza — co TikTok odrzucił

Recenzent wskazał **punkt 3/4 „Required UX Implementation in Your App"** i konkretnie **„Please showcase full interactions on Content Disclosure Setting."** Obecny `TikTokPublishOptions.tsx` ma zalążek tej sekcji, ale nie spełnia wszystkich wymogów. Sprawdziłem plik i porównałem z checklistą TikToka.

### Konkretne braki (co reviewer nie zobaczył na demo)

| # | Wymóg TikToka (pkt 3–4) | Stan obecny | Problem |
|---|---|---|---|
| 1 | Poziom prywatności nie może mieć wartości domyślnej — użytkownik musi świadomie wybrać | `defaultTikTokOptions()` ustawia `privacyLevel: "SELF_ONLY"` | Reviewer widzi już wybraną opcję → automatyczny fail |
| 2 | Gdy „Disclose video content" = ON, musi być widoczna **etykieta zgodności** informująca co pojawi się na filmie | Brak | Brak komunikatu „Your video will be labeled as **Promotional content** / **Paid partnership**" |
| 3 | Consent statement musi pojawić się **warunkowo** po włączeniu disclosure/branded, z odnośnikami do polityk **w treści zdania** | Linki są na dole karty zawsze | Reviewer musi zobaczyć, że tekst zgody pojawia się dokładnie po włączeniu toggle |
| 4 | Nie można pozwolić włączyć „Branded content" bez wybrania jednej z opcji (Your brand LUB Branded content) — muszą być dostępne obie i widoczne po włączeniu Disclosure | Ma toggle Disclosure + 2 pod-toggle | OK strukturalnie, ale brakuje twardej walidacji: „musisz zaznaczyć co najmniej jedno" |
| 5 | Branded content = SELF_ONLY musi być zablokowane hard (nie da się publikować) | Pokazywany alert, ale przycisk „Publikuj" nie jest blokowany na poziomie kampanii | Trzeba zwrócić błąd walidacji z komponentu |
| 6 | Music Usage Confirmation pokazywany **zawsze** przy włączonym Disclosure; Branded Content Policy pokazywany tylko dla Branded | Oba linki zawsze na dole | Trzeba warunkowo w consent statement |
| 7 | Interakcje (comment/duet/stitch) — TikTok chce zobaczyć że użytkownik może je przełączyć — jest OK | OK | – |

### Zakres zmian

**Pliki dotknięte (tylko frontend UX — bez zmian w edge functions / API):**

1. `src/components/campaigns/TikTokPublishOptions.tsx` — główna przebudowa sekcji Disclosure
2. `src/components/campaigns/CampaignSetup.tsx` (albo miejsce gdzie wywoływane) — walidacja przycisku „Publikuj" gdy `privacyLevel === ""`

**Nowy default `defaultTikTokOptions()`:**
```ts
privacyLevel: ""   // NIE ustawiamy domyślnej — user musi wybrać
```

**Nowa struktura karty Disclosure w `TikTokPublishOptions.tsx`:**

```
┌── Ustawienia ujawnienia treści ─────────────────────┐
│ [ ] Ujawnij treść wideo                              │
│     Włącz jeśli film promuje markę, produkt, usługę │
│                                                      │
│  ↓ Gdy ON, pojawia się:                              │
│                                                      │
│  Wybierz przynajmniej jedną opcję: *                 │
│  [ ] Twoja marka                                     │
│      Promujesz własną markę/produkt/usługę           │
│      → etykieta „Promotional content"                │
│                                                      │
│  [ ] Treść markowa (Branded content)                 │
│      Płatne partnerstwo z marką trzecią              │
│      → etykieta „Paid partnership"                   │
│      ⚠ Nie może być „Tylko ja"                       │
│                                                      │
│  ┌── Compliance label preview ──────────────────┐   │
│  │ ✓ Twój film zostanie oznaczony jako:         │   │
│  │   "Promotional content" (i/lub)              │   │
│  │   "Paid partnership"                          │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌── Consent statement (warunkowy) ─────────────┐   │
│  │ Publikując akceptujesz:                       │   │
│  │  • Music Usage Confirmation ↗ (zawsze)        │   │
│  │  • Branded Content Policy ↗ (tylko branded)   │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**Nowe błędy walidacji zwracane z komponentu (blokują „Publikuj"):**

- `privacyLevel === ""` → „Wybierz poziom prywatności."
- `discloseContent && !brandOrganic && !brandedContent` → „Zaznacz co najmniej jedną opcję: Twoja marka lub Treść markowa."
- `brandedContent && privacyLevel === "SELF_ONLY"` → „Treści markowej nie można publikować jako Tylko ja."

Komponent otrzyma nowy prop `onValidChange(isValid: boolean)`, żeby nadrzędny formularz mógł disable'ować „Publikuj".

### Co nagrać w demo video (pod pkt 3–4)

Nagranie musi krok po kroku pokazać:

1. Wybór wideo → wchodzę w opcje TikTok
2. „Privacy level" jest **pusty** — klikam „Publiczne"
3. Klikam Disclosure toggle → pojawia się sekcja z dwoma opcjami (obie odznaczone), pole „Publikuj" jest zablokowane
4. Zaznaczam „Twoja marka" → pojawia się etykieta „Promotional content" + consent statement z linkiem „Music Usage Confirmation"
5. Zaznaczam też „Branded content" → dochodzi „Paid partnership" + link „Branded Content Policy"
6. Zmieniam prywatność na „Tylko ja" → pojawia się czerwony alert, „Publikuj" zablokowany
7. Wracam na „Publiczne" → alert znika, klikam „Publikuj"

### Poza zakresem (nie ruszam)

- Edge functions (`publish-to-tiktok`, `tiktok-creator-info`) — logika już poprawnie przekazuje wszystkie flagi
- OAuth flow, revoke, callback
- Baza danych — kolumny `tiktok_*` już istnieją

### Podsumowanie techniczne

3 zmiany kluczowe: (a) `privacyLevel` domyślnie pusty + walidacja, (b) warunkowy compliance-label + consent statement w miejscu Disclosure zamiast na dole, (c) blokada „Publikuj" gdy warunki UX niespełnione. Reszta karty (poziomy prywatności, interakcje, dwa pod-toggle disclosure) już jest.