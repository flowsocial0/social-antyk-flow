
# Plan: Naprawienie błędów publikacji Facebook - Blob URL i uprawnienia

## Zdiagnozowane problemy

### Problem 1: Blob URL zamiast publicznego URL
**Przyczyna**: W `SimpleCampaignSetup.tsx` gdy upload do Storage się nie powiedzie, system wciąż zapisuje lokalny blob URL (`blob:https://...`) zamiast `null`. Facebook nie może pobrać obrazu z blob URL i zwraca błąd `(#100) url should represent a valid URL`.

**Lokalizacja błędu** (linie 189-193):
```typescript
postsWithUploadedMedia.push({ 
  ...post, 
  imageUrl: post.imageFile ? uploadedImageUrl : undefined, // ← uploadedImageUrl może być blob URL!
  videoUrl: post.videoFile ? uploadedVideoUrl : undefined
});
```

### Problem 2: Stary token Facebook (konto m@ag.da)
Token został utworzony 21 stycznia - **przed** dodaniem nowych scope'ów (`business_management`). Dlatego Facebook zwraca błąd o brakujących uprawnieniach.

**Rozwiązanie**: Użytkownik m@ag.da musi odłączyć i ponownie połączyć konto Facebook.

---

## Planowane zmiany

### Krok 1: Naprawienie logiki uploadu w SimpleCampaignSetup.tsx

**Plik**: `src/components/campaigns/SimpleCampaignSetup.tsx`

Zmiana logiki tak, aby przy błędzie uploadu ustawiać `undefined` zamiast blob URL:

```typescript
// Upload images and videos
const postsWithUploadedMedia: SimplePost[] = [];
for (const post of posts) {
  let uploadedImageUrl: string | undefined = undefined;
  let uploadedVideoUrl: string | undefined = undefined;
  
  // Upload image if present
  if (post.imageFile) {
    const fileName = `${user.id}/${Date.now()}_${post.imageFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("ObrazkiKsiazek")
      .upload(fileName, post.imageFile);

    if (uploadError) {
      console.error("Image upload error:", uploadError);
      toast.error(`Błąd uploadu grafiki dla posta: ${uploadError.message}`);
      // uploadedImageUrl pozostaje undefined
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from("ObrazkiKsiazek")
        .getPublicUrl(fileName);
      uploadedImageUrl = publicUrl;
    }
  }
  
  // Upload video if present
  if (post.videoFile) {
    const fileName = `${user.id}/videos/${Date.now()}_${post.videoFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("ObrazkiKsiazek")
      .upload(fileName, post.videoFile);

    if (uploadError) {
      console.error("Video upload error:", uploadError);
      toast.error(`Błąd uploadu wideo dla posta: ${uploadError.message}`);
      // uploadedVideoUrl pozostaje undefined
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from("ObrazkiKsiazek")
        .getPublicUrl(fileName);
      uploadedVideoUrl = publicUrl;
    }
  }
  
  postsWithUploadedMedia.push({ 
    ...post, 
    imageUrl: uploadedImageUrl,  // Zawsze publiczny URL lub undefined
    videoUrl: uploadedVideoUrl   // Zawsze publiczny URL lub undefined
  });
}
```

### Krok 2: Dodanie walidacji URL w Edge Function

**Plik**: `supabase/functions/publish-to-facebook/index.ts`

Dodanie sprawdzenia czy URL nie jest blob URL przed wysłaniem do Facebooka:

```typescript
// Validate that URL is not a blob URL
const validateMediaUrl = (url: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('blob:')) {
    console.warn('Invalid blob URL detected, skipping:', url.substring(0, 50));
    return undefined;
  }
  return url;
};

// Before publishing, validate URLs:
finalImageUrl = validateMediaUrl(finalImageUrl) || '';
finalVideoUrl = validateMediaUrl(finalVideoUrl) || '';
```

### Krok 3: Poprawiony komunikat błędu

Dodanie lepszego komunikatu błędu gdy brak obrazu/wideo:

```typescript
if (!postText && !finalImageUrl && !finalVideoUrl) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      message: 'Post musi zawierać tekst lub prawidłowy obraz/wideo. Upewnij się, że media zostały poprawnie załadowane.',
      errorCode: 'NO_CONTENT'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}
```

---

## Wymagane działania użytkownika

### Dla m@ag.da:
1. Przejdź do **Ustawienia → Konta społecznościowe**
2. Kliknij **Odłącz** przy koncie Facebook "Trener umiejętności wychowawczych"
3. Kliknij **Połącz Facebook** ponownie
4. Zaakceptuj **wszystkie uprawnienia** (w tym nowe `business_management`)

### Dla nieudanej kampanii:
Po połączeniu konta kliknij **"Wyślij ponownie"** przy nieudanym poście. Jeśli obraz nie został prawidłowo załadowany, utwórz nową kampanię.

---

## Podsumowanie zmian

| Element | Zmiana |
|---------|--------|
| `SimpleCampaignSetup.tsx` | Inicjalizacja `uploadedImageUrl`/`uploadedVideoUrl` jako `undefined`, nie blob URL |
| `publish-to-facebook` | Walidacja URL przed wysłaniem do API Facebook |
| Komunikat błędu | Lepszy komunikat gdy brak prawidłowego media |

Po tych zmianach blob URL nigdy nie trafi do bazy danych ani do Facebooka.
