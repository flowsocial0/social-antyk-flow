

# Plan naprawy - 4 zgłoszone problemy

## Przegląd problemów

| Nr | Problem | Priorytet | Złożoność |
|----|---------|-----------|-----------|
| 1 | Admin: domyślne ustawienia (hashtagi, dopiski) | Średni | Niska (już działa) |
| 2 | X: reset "za godzinę" od kilku godzin - błędna informacja | Wysoki | Niska |
| 3 | Ujednolicenie paska sociali na stronach platform | Średni | Średnia |
| 4 | Testy end-to-end wszystkich sociali i opcji | Wysoki | Wysoka |

---

## Problem 1: Admin - domyślne ustawienia

### Diagnoza
Funkcjonalność **już istnieje** i działa poprawnie:
- `AdminDefaultSettings` komponent jest w panelu Admin (linia 351 w Admin.tsx)
- `useUserSettings` hook ma fallback na `admin_settings` (linie 62-87)
- Admin może ustawiać: sufiksy AI per platforma + domyślny URL strony

### Zmiany
Dodanie pola **"Domyślne hashtagi"** per platforma (oprócz istniejących sufiksów AI), ponieważ użytkownik wspomniał o "hashtagach" jako osobnej opcji.

**Plik: `src/components/admin/AdminDefaultSettings.tsx`**
- Dodać sekcję "Domyślne hashtagi" z polami per platforma:
  - `default_hashtags_x`, `default_hashtags_facebook`, `default_hashtags_instagram`, `default_hashtags_tiktok`, `default_hashtags_youtube`
- Dodać pole "LinkedIn" do sufiksów AI (obecnie brakuje LinkedIn w AdminDefaultSettings)

**Plik: `src/hooks/useUserSettings.ts`**
- Rozszerzyć interfejs `UserSettings` o pola hashtagów
- Rozszerzyć o `ai_suffix_linkedin`

**Plik: `src/pages/Settings.tsx`**
- Dodać sekcję hashtagów w ustawieniach użytkownika
- Dodać pole LinkedIn do sufiksów

---

## Problem 2: X - reset "za godzinę" od kilku godzin

### Diagnoza
Problem: `formatDistanceToNow` z date-fns zaokrągla czas i pokazuje "za około godzinę" nawet gdy do resetu zostało kilka godzin. Ponadto, reset_at jest obliczany na podstawie **najstarszej publikacji + 24h** (linie 87-100 w get-x-rate-limits), ale kiedy ta publikacja wypadnie z okna 24h, resetAt zmieni się na następną najstarszą - więc "za godzinę" się powtarza.

Dane z bazy: najstarsza publikacja w oknie 24h to `2026-02-06 02:00:08` - reset powinien być o `2026-02-07 02:00:08`.

### Zmiany

**Plik: `src/components/platforms/XRateLimitStatus.tsx`**
- Zamiast `formatDistanceToNow` (który zaokrągla), pokazywać **dokładną godzinę** resetu:

```typescript
// Zamiast: "Reset za około godzinę"
// Pokazuj: "Następny reset: 7 lut, 03:00" (konkretna data)
// Oraz: "Pozostało: 2h 15min"
```

- Dodać obliczenie godzin i minut:
```typescript
const resetDate = new Date(reset_at);
const diffMs = resetDate.getTime() - Date.now();
const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

// Wyświetlanie:
// "Następny reset: 7 lut, 03:00 (za Xh Ymin)"
```

- Jeśli `reset_at` jest w przeszłości, pokazać "Limit powinien się odnowić - odśwież"

**Plik: `supabase/functions/get-x-rate-limits/index.ts`**
- Poprawić logikę obliczania `resetAt`: zamiast obliczać z najstarszej publikacji, podać czas kiedy **pierwsza** publikacja wypadnie z okna 24h (co jest tym samym, ale upewnić się że logika jest poprawna)
- Dodać walidację: jeśli obliczony resetAt jest w przeszłości, ustawić na null (bo limit się już odnowił)

---

## Problem 3: Ujednolicenie paska sociali

### Diagnoza - obecny stan
Każda platforma ma inny header:

| Platforma | Styl headera | Przyciski |
|-----------|-------------|-----------|
| X | Prosty, biały bg | ArrowLeft (→ "/"), "Stwórz kampanię AI" |
| Facebook | Gradient header | ArrowLeft (→ "/"), "Testuj połączenie", "Połącz Facebook", "Kampania AI" |
| Instagram | Prosty, bez headera | "Powrót" (window.history.back) |
| LinkedIn | Prosty | "Powrót" (window.history.back) |
| YouTube | Prosty | "Powrót" (window.history.back) |
| TikTok | Prosty | "Powrót" (navigate("/")) |

### Docelowy stan
Wszystkie platformy powinny mieć **ten sam** header:
- Lewa strona: ArrowLeft + Ikona platformy + Nazwa + Opis
- Prawa strona: "Stwórz kampanię" (nawiguje do `/campaigns/new?platform={platformId}`) + "Powrót" (nawiguje do `/platforms`)

### Zmiany

**Nowy komponent: `src/components/platforms/PlatformHeader.tsx`**
- Wspólny komponent headera dla wszystkich platform:

```typescript
interface PlatformHeaderProps {
  platformId: string;
  platformName: string;
  icon: React.ReactNode;
  description?: string;
}

export function PlatformHeader({ platformId, platformName, icon, description }: PlatformHeaderProps) {
  const navigate = useNavigate();
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/platforms')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h1 className="text-3xl font-bold">{platformName}</h1>
            <p className="text-muted-foreground">{description || `Zarządzaj publikacjami na ${platformName}`}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => navigate(`/campaigns/new?platform=${platformId}`)} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Stwórz kampanię
        </Button>
        <Button variant="outline" onClick={() => navigate('/platforms')}>
          Powrót
        </Button>
      </div>
    </div>
  );
}
```

**Pliki do zmiany (6 platform aktywnych):**

1. `src/pages/platforms/PlatformX.tsx` - Usunąć handleConnectX (przeniesiony do SocialAccounts), użyć PlatformHeader
2. `src/pages/platforms/PlatformFacebook.tsx` - Usunąć handleConnectFacebook i handleTestConnection (te są w SocialAccounts), użyć PlatformHeader, usunąć gradient header
3. `src/pages/platforms/PlatformInstagram.tsx` - Użyć PlatformHeader
4. `src/pages/platforms/PlatformLinkedIn.tsx` - Użyć PlatformHeader
5. `src/pages/platforms/PlatformYouTube.tsx` - Użyć PlatformHeader
6. `src/pages/platforms/PlatformTikTok.tsx` - Użyć PlatformHeader

Przy przejściu do kampanii z poziomu socialu: przycisk "Stwórz kampanię" automatycznie dodaje `?platform=x` (lub facebook/instagram/itd.) do URL, co powoduje że w kreatorze kampanii ta platforma jest już wstępnie wybrana.

Powrót: zawsze do `/platforms` (lista sociali).

---

## Problem 4: Testy end-to-end

### Diagnoza
To wymaga manualnych testów po implementacji zmian. Po wdrożeniu problemów 1-3, wykonam kompleksowe testy:

1. **Połączenia OAuth** - każda platforma osobno
2. **Publikowanie z listy książek** - tekst, tekst+obraz, tekst+video per platforma
3. **Kampanie** - tworzenie z jedną platformą, z kilkoma platformami, ze wszystkimi oprócz TikTok
4. **Kampanie indywidualne** - publikowanie pojedynczych postów
5. **Limity X** - weryfikacja globalnego limitu 15/dzień
6. **Ustawienia admina** - sufiksy, hashtagi, URL
7. **Ustawienia użytkownika** - nadpisywanie ustawień admina

Testy zostaną wykonane po implementacji przez otwarcie przeglądarki i przejście przez kluczowe flow.

---

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `src/components/admin/AdminDefaultSettings.tsx` | Dodanie hashtagów + LinkedIn suffix |
| `src/hooks/useUserSettings.ts` | Rozszerzenie o hashtagi + LinkedIn |
| `src/pages/Settings.tsx` | Dodanie hashtagów + LinkedIn |
| `src/components/platforms/XRateLimitStatus.tsx` | Dokładny czas resetu zamiast zaokrąglenia |
| `supabase/functions/get-x-rate-limits/index.ts` | Walidacja resetAt |
| **NOWY** `src/components/platforms/PlatformHeader.tsx` | Wspólny header |
| `src/pages/platforms/PlatformX.tsx` | Użycie PlatformHeader |
| `src/pages/platforms/PlatformFacebook.tsx` | Użycie PlatformHeader, usunięcie connect/test |
| `src/pages/platforms/PlatformInstagram.tsx` | Użycie PlatformHeader |
| `src/pages/platforms/PlatformLinkedIn.tsx` | Użycie PlatformHeader |
| `src/pages/platforms/PlatformYouTube.tsx` | Użycie PlatformHeader |
| `src/pages/platforms/PlatformTikTok.tsx` | Użycie PlatformHeader |

---

## Sekcja techniczna

### Reset time - poprawna logika

```text
Obecny problem:
  Najstarsza pub: 02:00 → reset: 02:00 (+24h)
  formatDistanceToNow(02:00 jutro) → "za około godzinę" (zaokrąglenie!)
  
  Gdy mija 02:00, ta pub wypada z okna 24h
  Nowa najstarsza: 04:00 → reset: 04:00 (+24h)
  formatDistanceToNow(04:00 jutro) → znowu "za około godzinę"!
  
Poprawka:
  Zamiast formatDistanceToNow, oblicz dokładnie:
  diffMs = resetDate - now
  hours = floor(diffMs / 3600000)
  minutes = floor((diffMs % 3600000) / 60000)
  Wyświetl: "za Xh Ymin (o HH:MM)"
```

### Architektura ustawień z hashtagami

```text
admin_settings.setting_value = {
  ai_suffix_x: "(ai)",
  ai_suffix_facebook: "",
  ai_suffix_instagram: "",
  ai_suffix_linkedin: "",
  default_hashtags_x: "#books",
  default_hashtags_facebook: "#books #reading",
  default_hashtags_instagram: "#books #bookstagram",
  default_website_url: "https://..."
}

user_settings = {
  ai_suffix_x: "(ai)",           // nadpisuje admin
  default_hashtags_x: "#mybooks", // nadpisuje admin
  ...
}

Priorytet: user_settings > admin_settings > hardcoded defaults
```

