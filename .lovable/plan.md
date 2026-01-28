
# Plan naprawy: LinkedIn, X.com (wiele kont) i timeout kampanii

## Problem 1: LinkedIn "Wymaga połączenia" mimo połączonego konta

### Analiza
Funkcje `checkConnectedPlatforms()` w komponentach kampanii sprawdzają tylko X, Facebook, TikTok, YouTube, Instagram - **brakuje LinkedIn**. Dlatego mimo połączenia konta, UI pokazuje "Wymaga połączenia".

### Zmiany

**Plik: `src/components/campaigns/CampaignSetup.tsx`**

Dodanie sprawdzenia LinkedIn w funkcji `checkConnectedPlatforms()`:

```typescript
const checkConnectedPlatforms = async () => {
  const platforms = getAllPlatforms();
  const connectionStatus: Record<string, boolean> = {};

  // Check X connection
  const { data: xData } = await (supabase as any).from('twitter_oauth1_tokens').select('id').limit(1).maybeSingle();
  
  // Check Facebook connection
  const { data: fbData } = await (supabase as any).from('facebook_oauth_tokens').select('id').limit(1).maybeSingle();
  
  // Check TikTok connection
  const { data: tiktokData } = await (supabase as any).from('tiktok_oauth_tokens').select('id').limit(1).maybeSingle();
  
  // Check YouTube connection
  const { data: ytData } = await (supabase as any).from('youtube_oauth_tokens').select('id').limit(1).maybeSingle();
  
  // Check Instagram connection  
  const { data: igData } = await (supabase as any).from('instagram_oauth_tokens').select('id').limit(1).maybeSingle();
  
  // ✅ DODAĆ: Check LinkedIn connection
  const { data: linkedinData } = await (supabase as any).from('linkedin_oauth_tokens').select('id').limit(1).maybeSingle();

  platforms.forEach(platform => {
    if (platform.id === 'x') connectionStatus[platform.id] = !!xData;
    else if (platform.id === 'facebook') connectionStatus[platform.id] = !!fbData;
    else if (platform.id === 'tiktok') connectionStatus[platform.id] = !!tiktokData;
    else if (platform.id === 'youtube') connectionStatus[platform.id] = !!ytData;
    else if (platform.id === 'instagram') connectionStatus[platform.id] = !!igData;
    else if (platform.id === 'linkedin') connectionStatus[platform.id] = !!linkedinData; // ✅ NOWE
    else connectionStatus[platform.id] = false;
  });
  setConnectedPlatforms(connectionStatus as Record<PlatformId, boolean>);
};
```

**Plik: `src/components/campaigns/SimpleCampaignSetup.tsx`**

Identyczna zmiana - dodanie LinkedIn do sprawdzenia połączenia.

**Plik: `src/components/campaigns/AccountSelector.tsx`**

Dodanie pobierania kont LinkedIn:

```typescript
const loadAccounts = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const [xResult, fbResult, igResult, tiktokResult, ytResult, linkedinResult] = await Promise.all([
    // ... existing queries ...
    (supabase as any).from('linkedin_oauth_tokens').select('id, display_name, account_name, is_default').eq('user_id', session.user.id),
  ]);

  const newAccounts: Record<string, AccountOption[]> = {
    // ... existing mappings ...
    linkedin: (linkedinResult.data || []).map((a: any) => ({
      id: a.id,
      display_name: a.display_name || a.account_name || 'Profil LinkedIn',
      is_default: a.is_default ?? false,
    })),
  };
  // ...
};
```

---

## Problem 2: X.com - nie można dodać kolejnego konta

### Analiza
OAuth 1.0a automatycznie loguje użytkownika do aktualnie zalogowanego konta X.com w przeglądarce. Potrzebny jest parametr `force_login=true` w URL autoryzacji, który wymusi wyświetlenie ekranu logowania X.

### Zmiany

**Plik: `supabase/functions/twitter-oauth1-start/index.ts`**

Zmiana URL autoryzacji z `authenticate` na `authorize` z parametrem `force_login`:

```typescript
// PRZED:
const authUrl = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauth_token}`;

// PO:
const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauth_token}&force_login=true`;
```

**Różnica:**
- `/oauth/authenticate` - automatyczne logowanie jeśli użytkownik ma aktywną sesję X
- `/oauth/authorize` + `force_login=true` - zawsze pokazuje formularz logowania X

---

## Problem 3: Timeout kampanii przy 350-500 postach

### Analiza
Edge Function `generate-campaign` ma limit czasu wykonania. Dla 500 postów:
- 100 partii × 5 postów
- 100 × 1 sekunda opóźnienia = 100 sekund
- + czas generacji Grok (~2-5 sek/partia) = 300-600 sekund
- Limit Edge Function: ~30-60 sekund

### Rozwiązanie: Generowanie partiami z zapisem postępu

**Plik: `supabase/functions/generate-campaign/index.ts`**

Dodanie trybu "batch mode" z zapisem postępu do bazy:

```typescript
// Nowa funkcja pomocnicza
async function generatePostsBatched(body: any, apiKey: string) {
  const { campaignId, batchIndex = 0, batchSize = 10, ...restBody } = body;
  
  // 1. Pobierz strukturę kampanii z bazy (jeśli istnieje)
  // 2. Wygeneruj tylko partię postów (np. 10)
  // 3. Zapisz wyniki do bazy jako draft
  // 4. Zwróć informację o postępie i czy jest więcej do wygenerowania
  
  return { 
    success: true, 
    completed: currentBatch * batchSize,
    total: totalPosts,
    hasMore: (currentBatch + 1) * batchSize < totalPosts,
    nextBatchIndex: currentBatch + 1
  };
}
```

**Plik: `src/components/campaigns/CampaignBuilder.tsx`**

Zmiana generowania na pętlę z aktualizacją postępu:

```typescript
const generateCampaignBatched = async () => {
  let hasMore = true;
  let batchIndex = 0;
  
  while (hasMore) {
    const { data, error } = await supabase.functions.invoke('generate-campaign', {
      body: {
        action: 'generate_posts_batch',
        campaignId,
        batchIndex,
        batchSize: 10,
        // ... other params
      }
    });
    
    if (error) throw error;
    
    // Update progress UI
    setProgress((data.completed / data.total) * 100);
    setGeneratedCount(data.completed);
    
    hasMore = data.hasMore;
    batchIndex = data.nextBatchIndex;
    
    // Small delay between batches to prevent rate limiting
    if (hasMore) await new Promise(r => setTimeout(r, 500));
  }
};
```

**Tabela pomocnicza (nowa migracja)**:

```sql
CREATE TABLE IF NOT EXISTS campaign_generation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  user_id UUID NOT NULL,
  total_posts INTEGER NOT NULL,
  generated_posts INTEGER DEFAULT 0,
  structure JSONB,
  posts JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Podsumowanie zmian

| Problem | Plik | Zmiana |
|---------|------|--------|
| LinkedIn "Wymaga połączenia" | `CampaignSetup.tsx` | Dodanie sprawdzenia `linkedin_oauth_tokens` |
| LinkedIn "Wymaga połączenia" | `SimpleCampaignSetup.tsx` | Dodanie sprawdzenia `linkedin_oauth_tokens` |
| LinkedIn "Wymaga połączenia" | `AccountSelector.tsx` | Dodanie pobierania kont LinkedIn |
| X.com wiele kont | `twitter-oauth1-start/index.ts` | Zmiana URL na `authorize?force_login=true` |
| Timeout kampanii | `generate-campaign/index.ts` | Tryb batch z zapisem postępu |
| Timeout kampanii | `CampaignBuilder.tsx` | Pętla generowania z aktualizacją UI |
| Timeout kampanii | Nowa migracja | Tabela `campaign_generation_progress` |

---

## Sekcja techniczna

### Szczegóły implementacji X.com force_login

Twitter API rozróżnia dwa endpointy:
- `GET /oauth/authenticate` - SSO flow, pomija logowanie jeśli użytkownik ma sesję
- `GET /oauth/authorize` - wymusza autoryzację za każdym razem

Parametr `force_login=true` dodatkowo wymusza wyświetlenie formularza logowania nawet przy aktywnej sesji.

### Architektura generowania partiami

```text
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  1. Wywołaj generate_posts_batch(batchIndex=0)               │
│  2. Odbierz odpowiedź z postępem                             │
│  3. Aktualizuj pasek postępu                                 │
│  4. Jeśli hasMore=true → powtórz z batchIndex++              │
│  5. Kiedy hasMore=false → pobierz wszystkie posty            │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│              Edge Function (generate-campaign)               │
├─────────────────────────────────────────────────────────────┤
│  • Pobierz strukturę z tabeli progress (lub wygeneruj)       │
│  • Wygeneruj tylko 10 postów (1 partia)                      │
│  • Zapisz posty do tabeli progress                           │
│  • Zwróć postęp i hasMore                                    │
│  • Całość < 30 sekund                                        │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Database                           │
├─────────────────────────────────────────────────────────────┤
│  campaign_generation_progress                                │
│  • structure: JSONB (plan kampanii)                          │
│  • posts: JSONB (wygenerowane posty, przyrastające)          │
│  • generated_posts: INT (licznik postępu)                    │
└─────────────────────────────────────────────────────────────┘
```

### Automatyczny wybór konta LinkedIn (1 konto = auto)

W `AccountSelector.tsx` już istnieje logika auto-selekcji:

```typescript
useEffect(() => {
  if (loading) return;
  
  selectedPlatforms.forEach(platform => {
    const platformAccounts = accounts[platform] || [];
    if (platformAccounts.length > 0 && (!selectedAccounts[platform] || selectedAccounts[platform].length === 0)) {
      // Auto-select default account or first account
      const defaultAccount = platformAccounts.find(a => a.is_default);
      newSelectedAccounts[platform] = [defaultAccount?.id || platformAccounts[0].id];
    }
  });
}, [selectedPlatforms, accounts, loading]);
```

Po dodaniu LinkedIn do `loadAccounts()`, ta logika automatycznie zadziała również dla LinkedIn.
