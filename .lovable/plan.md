
# Kompleksowy plan naprawy - 12 zgłoszonych problemów

## Przegląd problemów

| Nr | Problem | Priorytet | Złożoność |
|----|---------|-----------|-----------|
| 1 | Admin: domyślne ustawienia dla użytkowników | Średni | Średnia |
| 2 | Generowanie postów: tylko produkty danego użytkownika | Wysoki | Niska |
| 3 | ScheduleCalendar: brak podglądu wideo | Niski | Niska |
| 4 | Copy/Resume: brak kopiowania obrazków/wideo | Wysoki | Średnia |
| 5 | "Dodaj post": brak uploadu mediów | Średni | Średnia |
| 6 | Kampania: X pokazywane mimo niewybrania | Średni | Niska |
| 7 | Ciekawostki: ukryć opcję pobierania tekstów z bazy | Niski | Niska |
| 8 | Slider proporcji: odwrócona logika | Niski | Niska |
| 9 | Facebook video: polskie znaki w nazwie | Wysoki | Średnia |
| 10 | Edycja postów: dodanie mediów do istniejących | Średni | Średnia |
| 11 | LinkedIn/YT/TikTok: brak wyboru konta | Wysoki | Średnia |
| 12 | YouTube: brakujący tytuł przy prostym publikowaniu | Średni | Niska |

---

## Problem 0: Pokazuj tylko limit aplikacji (nie użytkownika)

### Diagnoza
Komponent `XRateLimitStatus` pokazuje limity per użytkownik (17 dziennie), ale X Free tier ma również wspólny limit aplikacyjny (1500/miesiąc). Użytkownik chce widzieć tylko limit aplikacyjny.

### Zmiany
**Plik: `src/components/platforms/XRateLimitStatus.tsx`**
- Usunięcie wyświetlania per-konto limitów użytkownika
- Skupienie na limicie aplikacji (`x-app-limit-24hour-remaining`)
- Modyfikacja `get-x-rate-limits` Edge Function aby zwracał limit aplikacji

**Plik: `supabase/functions/get-x-rate-limits/index.ts`**
- Dodanie pobierania limitu aplikacji z tabeli `platform_rate_limits` (limit_type = 'app_daily')
- Zwracanie tylko podsumowania limitu aplikacji

---

## Problem 1: Admin - domyślne ustawienia dla użytkowników

### Diagnoza
Brak tabeli `admin_settings` do przechowywania domyślnych ustawień. Hook `useUserSettings` nie sprawdza ustawień admina jako fallback.

### Zmiany

**Nowa migracja: `admin_settings`**
```sql
CREATE TABLE admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: tylko admin może modyfikować
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON admin_settings FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Everyone can read settings" ON admin_settings FOR SELECT USING (true);
```

**Plik: `src/pages/Admin.tsx`**
- Dodanie sekcji "Domyślne ustawienia użytkowników" z formularzem:
  - Domyślne sufiksy AI dla każdej platformy
  - Domyślny URL strony

**Plik: `src/hooks/useUserSettings.ts`**
- Modyfikacja `fetchSettings()` aby:
  1. Pobierało ustawienia użytkownika
  2. Jeśli użytkownik nie ma ustawień, pobierało `admin_settings` z kluczem 'default_user_settings'
  3. Mergowało ustawienia (user > admin > kod default)

---

## Problem 2: Generowanie postów - tylko produkty danego użytkownika

### Diagnoza
Edge Function `generate-campaign` prawdopodobnie nie filtruje po `user_id` przy pobieraniu książek do kampanii.

### Zmiany
**Plik: `supabase/functions/generate-campaign/index.ts`**
- Sprawdzenie i upewnienie się, że wszystkie zapytania do tabeli `books` zawierają `.eq('user_id', userId)`
- W funkcji `generateSimpleCampaign` i `generateWithAI` dodanie filtrowania:
```typescript
const { data: books } = await supabase
  .from('books')
  .select('*')
  .eq('user_id', userId)  // KRYTYCZNE
  .in('id', selectedBooks);
```

---

## Problem 3: ScheduleCalendar - brak podglądu wideo

### Diagnoza
Komponent `ScheduleCalendar` pokazuje tylko obrazki z `post.book.image_url`. Brak sprawdzenia czy to wideo i odpowiedniego wyświetlenia.

### Zmiany
**Plik: `src/components/schedule/ScheduleCalendar.tsx`**
- Dodanie sprawdzenia czy URL to wideo (podobnie jak w `CampaignPostCard`)
- Dodanie komponentu podglądu wideo z ikoną play:
```typescript
const isVideo = /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(mediaUrl);

if (isVideo) {
  return (
    <div className="relative w-12 h-16">
      <Video className="absolute inset-0 m-auto h-6 w-6 text-white z-10" />
      <video src={mediaUrl} className="w-12 h-16 object-cover rounded bg-black/50" muted />
    </div>
  );
}
```

---

## Problem 4: Copy/Resume kampanii - brak kopiowania obrazków/wideo

### Diagnoza
`ResumeCampaignDialog` i `CopyCampaignDialog` nie kopiują `custom_image_url` z oryginalnych postów.

### Zmiany

**Plik: `src/components/campaigns/ResumeCampaignDialog.tsx`**
- Rozszerzenie interfejsu `posts` o `custom_image_url`:
```typescript
posts: Array<{
  // ... existing fields
  custom_image_url?: string | null;
}>;
```
- W pętli tworzenia postów dodanie:
```typescript
const { error: postError } = await supabase
  .from('campaign_posts')
  .insert({
    // ... existing fields
    custom_image_url: originalPost.custom_image_url, // NOWE
  });
```

**Plik: `src/components/campaigns/CopyCampaignDialog.tsx`**
- Ten komponent tylko przekazuje konfigurację do kreatora, więc problem dotyczy CampaignBuilder
- Należy upewnić się, że `CampaignPlan.tsx` kopiuje `custom_image_url` przy regeneracji

---

## Problem 5: "Dodaj post" - brak uploadu mediów

### Diagnoza
Dialog "Dodaj nowy post" w `CampaignDetails.tsx` (linie 738-831) nie ma pól do uploadu obrazka/wideo.

### Zmiany
**Plik: `src/pages/CampaignDetails.tsx`**
- Dodanie state dla mediów:
```typescript
const [newPostImage, setNewPostImage] = useState<File | null>(null);
const [newPostVideo, setNewPostVideo] = useState<File | null>(null);
const [newPostImagePreview, setNewPostImagePreview] = useState<string>('');
```
- Dodanie sekcji uploadu mediów w dialogu (po polu treści):
```typescript
<div className="space-y-2">
  <Label>Media (opcjonalne)</Label>
  <div className="flex gap-3">
    <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg hover:bg-muted/50">
      <Image className="h-4 w-4" />
      <span>Dodaj grafikę</span>
      <input type="file" accept="image/*" className="hidden" onChange={handleNewPostImageUpload} />
    </Label>
    <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg hover:bg-muted/50">
      <Video className="h-4 w-4" />
      <span>Dodaj wideo</span>
      <input type="file" accept="video/*" className="hidden" onChange={handleNewPostVideoUpload} />
    </Label>
  </div>
  {/* Podgląd */}
</div>
```
- Modyfikacja `addPostMutation` aby uploadował media do Storage i zapisywał URL w `custom_image_url`

---

## Problem 6: Kampania pokazuje X mimo niewybrania

### Diagnoza
W `CampaignDetails.tsx` (linia 693-729) sekcja "Konta do publikacji" wyświetla konta z `campaign.selected_accounts`, ale może też pokazywać fallback na `target_platforms` który domyślnie ma `['x']`.

### Zmiany
**Plik: `src/pages/CampaignDetails.tsx`**
- Zmiana logiki fallbacku:
```typescript
// Stary kod (linie 711-723):
// Fallback for older campaigns - show target platforms
(campaign.target_platforms as string[] || ['x']).map(...)

// Nowy kod:
// Tylko pokazuj platformy które faktycznie są w target_platforms
// NIE pokazuj fallback ['x'] jeśli target_platforms jest puste
(campaign.target_platforms as string[] || []).length > 0 
  ? (campaign.target_platforms as string[]).map(...)
  : <span className="text-sm text-muted-foreground">Brak wybranych platform</span>
```

---

## Problem 7: Ciekawostki - ukryć opcję pobierania tekstów z bazy

### Diagnoza
W `CampaignSetup.tsx` checkbox "Użyj zapisanych postów z poprzednich kampanii" (`regenerateTexts`) jest widoczny nawet gdy wybrano "tylko ciekawostki" (`useRandomContent`).

### Zmiany
**Plik: `src/components/campaigns/CampaignSetup.tsx`**
- Ukrycie sekcji `regenerateTexts` gdy `useRandomContent` jest true:
```typescript
// Linia ~234-247: Dodać warunek
{!useRandomContent && (
  <div className="flex items-center space-x-3 mb-4 p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
    <Checkbox id="regenerateTexts" ... />
    ...
  </div>
)}
```

---

## Problem 8: Slider proporcji - odwrócona logika

### Diagnoza
W `CampaignSetup.tsx` slider ustawia `contentRatio` (% ciekawostek), ale wizualnie sugeruje że lewa strona to ciekawostki a prawa to sprzedaż. Logika jest poprawna, ale UI może być mylące.

### Analiza kodu (linie 281-303):
```typescript
<span>Ciekawostki: {contentRatio}%</span>
<Slider value={[contentRatio]} ... />
<span>Sprzedaż: {100 - contentRatio}%</span>
```

### Zmiany
**Plik: `src/components/campaigns/CampaignSetup.tsx`**
Sprawdzić czy slider działa poprawnie:
- Lewa strona (wartość 0) = 0% ciekawostek, 100% sprzedaży
- Prawa strona (wartość 100) = 100% ciekawostek, 0% sprzedaży

Jeśli użytkownik mówi że jest "odwrotnie", to może chce:
- Lewa = więcej ciekawostek
- Prawa = więcej sprzedaży

Rozwiązanie - odwrócenie wartości:
```typescript
// Zmiana na "salesRatio" zamiast "contentRatio":
const [salesRatio, setSalesRatio] = useState(80); // 80% sprzedaży

// Lub prościej - zamiana etykiet:
<span>Sprzedaż: {100 - contentRatio}%</span>
<Slider ... />  
<span>Ciekawostki: {contentRatio}%</span>
```

---

## Problem 9: Facebook video - polskie znaki w nazwie pliku

### Diagnoza
Facebook API może mieć problemy z URL-ami zawierającymi polskie znaki lub spacje. W `SimpleCampaignSetup.tsx` nazwa pliku jest używana bezpośrednio.

### Zmiany
**Plik: `src/components/campaigns/SimpleCampaignSetup.tsx`**
- Przy uploadzie wideo (linie 179-195) - sanityzacja nazwy pliku:
```typescript
// Zamień polskie znaki i spacje na bezpieczne znaki
const sanitizeFileName = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // usunięcie diakrytyków
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, c => ({
      'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
      'Ą':'A','Ć':'C','Ę':'E','Ł':'L','Ń':'N','Ó':'O','Ś':'S','Ź':'Z','Ż':'Z'
    })[c] || c)
    .replace(/\s+/g, '_')           // spacje na podkreślniki
    .replace(/[^a-zA-Z0-9._-]/g, ''); // usunięcie pozostałych znaków specjalnych
};

const fileName = `${user.id}/videos/${Date.now()}_${sanitizeFileName(post.videoFile.name)}`;
```

**Plik: `supabase/functions/publish-to-facebook/index.ts`**
- Przy pobieraniu URL wideo - upewnić się że URL jest poprawnie zakodowany:
```typescript
// Przed wysłaniem do Facebook API:
const encodedVideoUrl = encodeURI(finalVideoUrl);
```

---

## Problem 10: Edycja postów - dodawanie/zmiana mediów

### Diagnoza
`CampaignPostCard` pozwala tylko na edycję tekstu. Brak opcji zmiany/dodania obrazka lub wideo.

### Zmiany
**Plik: `src/components/campaigns/CampaignPostCard.tsx`**
- Rozszerzenie interfejsu `CampaignPostCardProps`:
```typescript
type CampaignPostCardProps = {
  // ... existing
  onUpdateMedia?: (postId: string, mediaUrl: string | null) => Promise<void>;
};
```
- Dodanie sekcji uploadu mediów w trybie edycji (po Textarea):
```typescript
{isEditing && (
  <div className="flex gap-3 mt-3">
    <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg">
      <Image className="h-4 w-4" />
      <span>Zmień grafikę</span>
      <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
    </Label>
    <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg">
      <Video className="h-4 w-4" />
      <span>Zmień wideo</span>
      <input type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
    </Label>
    {post.custom_image_url && (
      <Button variant="ghost" size="sm" onClick={() => onUpdateMedia?.(post.id, null)}>
        <X className="h-4 w-4" /> Usuń media
      </Button>
    )}
  </div>
)}
```
- Dodanie funkcji handlera uploadu i wywołania onUpdateMedia

**Plik: `src/pages/CampaignDetails.tsx`**
- Dodanie mutacji `updatePostMediaMutation`
- Przekazanie `onUpdateMedia` do `CampaignPostCard`

---

## Problem 11: LinkedIn/YT/TikTok - brak wyboru konta

### Diagnoza
`AccountSelector.tsx` już pobiera konta LinkedIn (linia 48-49), ale sprawdźmy czy są poprawnie wyświetlane i czy można je wybrać.

### Zmiany
**Plik: `src/components/campaigns/AccountSelector.tsx`**
- Upewnić się że LinkedIn jest w tablicy pobierania:
```typescript
const [xResult, fbResult, igResult, tiktokResult, ytResult, linkedinResult] = await Promise.all([
  // ... już jest linkedinResult
]);
```
- Sprawdzić czy mapowanie LinkedIn jest poprawne (linia 61-65) - wydaje się OK
- Problem może być w tym, że `platformsWithAccounts` filtruje platformy które mają konta, ale `selectedPlatforms` może nie zawierać LinkedIn

**Plik: `src/components/campaigns/SimpleCampaignSetup.tsx`**
- Sprawdzić czy `AccountSelector` jest używany dla wszystkich platform
- Upewnić się że platforma LinkedIn jest poprawnie przekazywana

Prawdopodobna przyczyna: Brak LinkedIn w logice auto-selekcji lub w warunku renderowania AccountSelector.

---

## Problem 12: YouTube - brakujący tytuł przy prostym publikowaniu

### Diagnoza
`publish-to-youtube` Edge Function wymaga `title` (linia 195-197). Przy prostym publikowaniu może nie być przekazywany.

### Zmiany
**Plik: `supabase/functions/publish-to-youtube/index.ts`**
- Lepszy fallback dla tytułu:
```typescript
if (!title) {
  // Fallback 1: użyj pierwszej linii tekstu (jeśli to kampania prosta)
  if (requestData.campaignPostId) {
    const { data: post } = await supabase
      .from('campaign_posts')
      .select('text')
      .eq('id', requestData.campaignPostId)
      .single();
    
    if (post?.text) {
      title = post.text.split('\n')[0].substring(0, 100);
    }
  }
  
  // Fallback 2: użyj nazwy pliku wideo
  if (!title && videoUrl) {
    const fileName = decodeURIComponent(videoUrl.split('/').pop() || '');
    title = fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').substring(0, 100);
  }
  
  // Fallback 3: generyczny tytuł
  if (!title) {
    title = `Publikacja ${new Date().toLocaleDateString('pl-PL')}`;
  }
}
```

**Plik: Wszystkie miejsca wywołujące publish-to-youtube**
- Upewnić się że `title` jest przekazywany w body requestu
- Sprawdzić `auto-publish-books` i inne funkcje

---

## Podsumowanie zmian według plików

| Plik | Zmiany |
|------|--------|
| **Nowa migracja** | Tabela `admin_settings` |
| `src/pages/Admin.tsx` | Sekcja domyślnych ustawień użytkowników |
| `src/hooks/useUserSettings.ts` | Fallback na ustawienia admina |
| `supabase/functions/generate-campaign/index.ts` | Filtr `user_id` przy pobieraniu książek |
| `src/components/schedule/ScheduleCalendar.tsx` | Podgląd wideo |
| `src/components/campaigns/ResumeCampaignDialog.tsx` | Kopiowanie `custom_image_url` |
| `src/pages/CampaignDetails.tsx` | Upload mediów w "Dodaj post", fallback platform |
| `src/components/campaigns/CampaignSetup.tsx` | Ukrycie regenerateTexts dla ciekawostek, slider |
| `src/components/campaigns/SimpleCampaignSetup.tsx` | Sanityzacja nazw plików |
| `supabase/functions/publish-to-facebook/index.ts` | Enkodowanie URL wideo |
| `src/components/campaigns/CampaignPostCard.tsx` | Edycja mediów |
| `src/components/campaigns/AccountSelector.tsx` | Sprawdzenie LinkedIn/YT/TikTok |
| `supabase/functions/publish-to-youtube/index.ts` | Fallback dla tytułu |
| `src/components/platforms/XRateLimitStatus.tsx` | Pokazanie tylko limitu aplikacji |
| `supabase/functions/get-x-rate-limits/index.ts` | Zwracanie limitu aplikacji |

---

## Sekcja techniczna

### Architektura domyślnych ustawień admina

```text
┌─────────────────────────────────────────────────┐
│               Admin Panel                        │
│  Ustawienia domyślne dla nowych użytkowników    │
└─────────────────────────────────────────────────┘
                      │
                      ▼ INSERT/UPDATE
┌─────────────────────────────────────────────────┐
│              admin_settings                      │
│  setting_key: 'default_user_settings'           │
│  setting_value: {                                │
│    ai_suffix_x: '(ai)',                         │
│    ai_suffix_facebook: '',                      │
│    default_website_url: 'https://...'           │
│  }                                               │
└─────────────────────────────────────────────────┘
                      │
                      ▼ SELECT (fallback)
┌─────────────────────────────────────────────────┐
│              useUserSettings()                   │
│  1. Sprawdź user_settings dla user_id           │
│  2. Jeśli brak → pobierz admin_settings         │
│  3. Merguj: user > admin > hardcoded defaults   │
└─────────────────────────────────────────────────┘
```

### Sanityzacja nazw plików dla Facebook

```text
Oryginalnie: "Książka o Polsce.mp4"
     │
     ▼ normalize('NFD') + replace diacritics
"Ksiazka o Polsce.mp4"
     │
     ▼ replace spaces
"Ksiazka_o_Polsce.mp4"
     │
     ▼ remove special chars
"Ksiazka_o_Polsce.mp4" ✅
```

### Logika kopiowania mediów przy Resume/Copy

```text
Oryginalna kampania:
  Post 1: text="...", custom_image_url="https://storage/.../photo.jpg"
  Post 2: text="...", custom_image_url="https://storage/.../video.mp4"
     │
     ▼ ResumeCampaignDialog.handleResume()
Nowa kampania:
  Post 1: text="...", custom_image_url="https://storage/.../photo.jpg" ← SKOPIOWANE
  Post 2: text="...", custom_image_url="https://storage/.../video.mp4" ← SKOPIOWANE
```
