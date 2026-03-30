

## Problem: Odmowa TikTok Review

TikTok wymaga:
1. **Website URL nie może być stroną logowania** -- obecnie `socialautoflow.pl` (route `/`) to strona Login
2. **Nazwa aplikacji musi pasować do TOS, Privacy Policy i Website** -- muszą być spójne ("Social Auto Flow")
3. **Wyjaśnienie jak każdy scope/produkt jest używany** -- to opis w panelu TikTok (nie kod)
4. **Strona musi być "fully developed website"** -- potrzebna publiczna strona główna, nie login

### Rozwiązanie: Publiczna strona główna (Landing Page)

Stworzymy prostą, publiczną stronę informacyjną na route `/` i przeniesiemy login na `/login`.

#### 1. Nowa strona główna (`src/pages/HomePage.tsx`)

Publiczna strona z:
- Nagłówek "Social Auto Flow" z logo/ikoną
- Krótki opis: "Automatyzacja publikacji w mediach społecznościowych dla księgarni"
- Sekcja "Jak to działa" -- 3-4 kroki z ikonami
- Sekcja "Obsługiwane platformy" -- ikony platform (X, Facebook, Instagram, TikTok, YouTube, LinkedIn, etc.)
- Przycisk "Zaloguj się" → `/login`
- Linki w stopce: Polityka Prywatności, Regulamin, Kontakt

#### 2. Zmiana routingu (`src/App.tsx`)

- Route `/` → `HomePage` (publiczny)
- Route `/login` → `Login` (bez zmian)
- Linki "Powrót" w Privacy Policy i Terms → `/`

#### 3. Spójność nazewnictwa

Sprawdzę i upewnię się, że wszędzie jest "Social Auto Flow":
- `index.html` title/meta
- Privacy Policy title
- Terms of Service title
- Login page header

#### 4. Co trzeba zmienić w panelu TikTok Developer (ręcznie)

- **Website URL**: `https://socialautoflow.pl` (teraz pokaże landing page, nie login)
- **App name**: Upewnić się, że brzmi "Social Auto Flow"
- **Opis scope'ów**: Dodać wyjaśnienie np. "Share Kit is used to publish book promotions to TikTok on behalf of the user"

### Szczegóły techniczne

**HomePage** -- prosty komponent z Tailwind, bez logiki backendowej. Responsywny, z sekcjami hero + features + platforms + footer. Bez animacji/efektów -- czysta informacyjna strona.

**Routing** -- jedyna zmiana w `App.tsx`: linia 113 zmieni się z `<Login />` na `<HomePage />`.

**Privacy/Terms** -- link "Powrót do strony głównej" już prowadzi do `/`, więc będzie działać.

