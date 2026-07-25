
# Biblioteka wideo — Supabase + Mega.nz (just-in-time)

Zmiana vs poprzedni plan: **usunąć opcję linka YouTube**, w zamian dodać **link Mega.nz** jako lekkie źródło. Pliki Mega żyją tylko na Mega; w momencie publikacji są pobierane do tymczasowego bucketu Supabase, publikowane na wybrane sociale, a po zakończeniu publikacji plik tymczasowy jest usuwany. Wzorzec już istnieje w `src/lib/megaVideoResolver.ts` — rozszerzam go, nie wymyślam od nowa.

## Zakres prac

### 1. Baza + storage

Nowa tabela `video_library`:
- `id`, `user_id`, `title`, `description`
- `source_type` (`supabase_upload` | `mega_link`) — bez YouTube, bez futurystycznych S3/R2 (dodamy gdy będzie potrzebne)
- `storage_path`, `public_url` — wypełnione dla `supabase_upload`
- `mega_url` — wypełnione dla `mega_link`
- `thumbnail_path`, `thumbnail_url` (dla mega: user może wgrać ręcznie miniaturę albo zostaje placeholder — Mega nie daje thumbnaili bez pobrania całego pliku)
- `file_size_mb`, `duration_sec`, `mime_type`, `width`, `height` (opcjonalne dla mega — user może wpisać rozmiar sam albo zostają NULL)
- `tags text[]`, `usage_count int`, timestamps
- RLS: user widzi tylko swoje

Bucket `video-library` (private, 500MB limit) — trzyma tylko realnie wgrane pliki (source_type=`supabase_upload`).
Bucket `ObrazkiKsiazek` już jest używany przez `megaVideoResolver` jako tymczasowe miejsce w folderze `temp-videos/` — reuse.

### 2. Fix uploadu (bez zmian względem poprzedniego planu)

- Podnieść `file_size_limit` bucketu do 500MB.
- Upload chunkami (`chunkSize: 6*1024*1024`) + progress bar.
- Walidacja rozmiaru vs limity platform docelowych z jasnym komunikatem.
- Blokada tworzenia `campaign_posts` gdy upload/rozwiązanie źródła padło.
- Auto-thumbnail z pierwszej klatki (`<video>` + `<canvas>`) — tylko dla `supabase_upload`.

### 3. Nowa strona `/videos`

- Grid z miniaturkami (dla mega: placeholder z ikoną Mega + tytuł, bo bez pobrania nie mamy klatki)
- Wyszukiwarka, sortowanie, filtry (w tym filtr po `source_type`: „Wgrane" / „Mega.nz")
- Przyciski w headerze: **„Wgraj wideo"** oraz **„Dodaj link Mega.nz"**
- Kafelek: edytuj tytuł/tagi, usuń, kopiuj link. Dla mega: podgląd nazwy pliku z Mega po walidacji URL (przez `MegaFile.fromURL().loadAttributes()` w tle — tylko metadane, bez pobierania zawartości)
- Licznik zajętego miejsca (tylko dla `supabase_upload`) + ostrzeżenie przy 80% limitu planu

### 4. Integracja z kreatorem kampanii

W `CampaignSetup.tsx` i `SimpleCampaignSetup.tsx`:
- Przycisk **„Wybierz z biblioteki"** → `VideoPickerDialog` (multi-select, wyszukiwarka)
- **„Użyj tego wideo dla wszystkich N postów kampanii"** — jeden klik zamiast 8× ręcznie
- Checkbox „Zapisz w bibliotece do ponownego użycia" przy ręcznym uploadzie (domyślnie ON)
- Fix trybu Zaawansowanego: dodać brakujące pole wideo (bug ze screena #1)

### 5. Publikacja plików Mega — just-in-time (kluczowa mechanika)

Wzorzec już żyje w `src/lib/megaVideoResolver.ts` (frontend, dla ręcznych publikacji z UI). Rozszerzam go na obie ścieżki:

**Ścieżka A — auto-publish w edge function (`auto-publish-books`):**
- Gdy `campaign_post.video_source = video_library_id` a wpis ma `source_type='mega_link'`:
  1. Edge function pobiera plik z Mega (Deno-native — użyć biblioteki `megajs` przez `esm.sh` lub `npm:megajs`; jeśli nie działa w Deno, alternatywnie odpalić resolve w Cloudflare-style relay przez osobną edge function `mega-resolve` która streamuje do Storage)
  2. Upload do `ObrazkiKsiazek/temp-videos/{post_id}-{ts}.mp4`
  3. Zapis URL do `campaign_posts.resolved_video_url` + `temp_video_path`
  4. Iteracja po wszystkich platformach z tego posta — używają tego jednego pliku tymczasowego
  5. Po zakończeniu wszystkich publikacji (sukces LUB finalna porażka) — cron/handler usuwa `temp_video_path` z Storage
  6. Fallback: cron `cleanup-temp-videos` (już istnieje) usuwa pliki starsze niż 24h — bezpiecznik

**Ścieżka B — ręczna publikacja z UI:**
- Reuse istniejącego `megaVideoResolver.ts` z browsera (już działa dla ręcznych publikacji z książek)

**Deduplikacja:** jeżeli ten sam `video_library_id` z Mega jest w wielu postach publikowanych w tej samej minucie/kampanii — pobrać raz, użyć wielokrotnie, potem usunąć. Klucz cache w tabeli `campaign_posts.temp_video_path` grupowany po `video_library_id`.

Nowe kolumny w `campaign_posts`:
- `video_library_id uuid` (referencja do wpisu w bibliotece)
- `temp_video_path text` (ścieżka pliku tymczasowego w Storage — sprząta cron)

### 6. Co usuwamy z poprzedniego planu

- Cała sekcja „Link YouTube jako źródło" — usunięta.
- Modyfikacje `publish-to-youtube`, `publish-to-tiktok`, `publish-to-instagram` i pozostałych publish-* pod obsługę linku YT — nie robimy.
- `YouTubeLinkDialog.tsx` — nie tworzymy.

## Pliki dotknięte

**Nowe:**
- `src/pages/VideoLibrary.tsx`
- `src/components/videos/VideoLibraryGrid.tsx`
- `src/components/videos/VideoCard.tsx`
- `src/components/videos/VideoUploadDialog.tsx`
- `src/components/videos/MegaLinkDialog.tsx` (walidacja URL + `loadAttributes` dla nazwy pliku)
- `src/components/videos/VideoPickerDialog.tsx`
- `src/lib/videoUpload.ts` (chunked upload + progress + thumbnail)

**Modyfikowane:**
- `src/App.tsx` — route `/videos`
- `src/components/dashboard/QuickActions.tsx` — kafelek „Biblioteka wideo"
- `src/components/campaigns/CampaignSetup.tsx` — przycisk „Wybierz z biblioteki" + multi-post apply + fix pola wideo
- `src/components/campaigns/SimpleCampaignSetup.tsx` — jw.
- `src/lib/megaVideoResolver.ts` — mała porządkowa refaktoryzacja (bez zmian API)
- `supabase/functions/auto-publish-books/index.ts` — obsługa `video_library_id` + resolve Mega przed publikacją + zapis `temp_video_path` + wywołanie cleanup po zakończeniu wszystkich platform
- `supabase/functions/cleanup-temp-videos/index.ts` — bezpiecznik: usuwa pliki `temp-videos/*` starsze niż 24h (jeśli logika post-publish nie sprzątnęła)

## Migracja bazy

```sql
CREATE TABLE public.video_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  source_type text NOT NULL CHECK (source_type IN ('supabase_upload','mega_link')),
  storage_path text,
  public_url text,
  mega_url text,
  thumbnail_path text,
  thumbnail_url text,
  file_size_mb numeric,
  duration_sec integer,
  mime_type text,
  width integer,
  height integer,
  tags text[] DEFAULT '{}',
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (
    (source_type = 'supabase_upload' AND storage_path IS NOT NULL) OR
    (source_type = 'mega_link' AND mega_url IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_library TO authenticated;
GRANT ALL ON public.video_library TO service_role;

ALTER TABLE public.video_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own videos select" ON public.video_library FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own videos insert" ON public.video_library FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own videos update" ON public.video_library FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own videos delete" ON public.video_library FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER video_library_updated_at BEFORE UPDATE ON public.video_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_video_library_user ON public.video_library(user_id, created_at DESC);
CREATE INDEX idx_video_library_tags ON public.video_library USING GIN(tags);

ALTER TABLE public.campaign_posts
  ADD COLUMN video_library_id uuid REFERENCES public.video_library(id) ON DELETE SET NULL,
  ADD COLUMN temp_video_path text;
```

Bucket `video-library` (private, `file_size_limit=500MB`) + RLS na `storage.objects` scope `bucket_id='video-library' AND auth.uid()::text = (storage.foldername(name))[1]`.

## Zalety modelu Mega just-in-time

- Zero kosztów storage Supabase dla plików Mega — user trzyma je u siebie.
- Egress Supabase liczy się tylko w momencie publikacji (upload z Mega → download przez API social) — plik znika po kilku minutach.
- Klient może mieć TB filmów na Mega bez płacenia za Pro plan Supabase.

## Ryzyka i mitigacje

- **`megajs` w Deno edge function** — jeśli biblioteka nie działa natywnie w Deno, fallback: dedykowana edge function `mega-resolve` używająca `npm:megajs` (Supabase Edge Functions wspierają npm od 2024). W razie całkowitej porażki: resolve pozostaje po stronie frontendu i wywołuje publikację przez istniejący flow (nie idealnie dla schedule, ale działa dla ręcznych publikacji).
- **Duże pliki Mega (>500MB)** — timeout edge function (max 400s). Dla shortów TikTok/Reels/YT Shorts (<100MB) nie ma problemu. Ostrzeżenie w UI Mega dialogu.
- **Cleanup** — dwuwarstwowy: post-publish + cron 24h.

## Szacowany czas: ~7h (bez YouTube; +1h ekstra za edge-side Mega resolver)

## Poza zakresem

- Kompresja w przeglądarce (FFmpeg.wasm) — dodam gdy ktoś zgłosi
- Preview miniaturek z Mega bez pobierania (Mega API nie udostępnia) — placeholder z ikoną Mega + tytuł
