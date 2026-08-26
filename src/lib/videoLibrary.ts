import { supabase } from "@/integrations/supabase/client";

export const VIDEO_BUCKET = "ObrazkiKsiazek";
export const VIDEO_PREFIX = "video-library";
/**
 * Realny limit pojedynczego obiektu w Supabase Storage na tym projekcie.
 * Większe pliki są odrzucane przez API ("The object exceeded the maximum allowed size"),
 * dlatego blokujemy je już w formularzu i kierujemy użytkownika na Mega.nz.
 */
export const MAX_UPLOAD_MB = 50;


export const MEGA_URL_REGEX = /^https?:\/\/mega\.nz\/(file|folder)\//;

export type VideoSourceType = "supabase_upload" | "mega_link";

export interface LibraryVideo {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  source_type: VideoSourceType;
  storage_path: string | null;
  public_url: string | null;
  mega_url: string | null;
  thumbnail_path: string | null;
  thumbnail_url: string | null;
  file_size_mb: number | null;
  duration_sec: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  tags: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/** URL used when publishing. For Mega links this is resolved just-in-time server-side. */
export function getVideoUrl(video: LibraryVideo): string {
  return (video.source_type === "mega_link" ? video.mega_url : video.public_url) || "";
}

export function isMegaUrl(url: string): boolean {
  return MEGA_URL_REGEX.test(url.trim());
}

export function sanitizeFileName(name: string): string {
  const map: Record<string, string> = {
    ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
    Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
  };
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c) => map[c] || c)
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || !isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatSize(mb: number | null): string {
  if (!mb) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

export interface VideoProbe {
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  thumbnailBlob: Blob | null;
}

/** Reads metadata and grabs a poster frame from a local video file, entirely in the browser. */
export function probeVideoFile(file: File): Promise<VideoProbe> {
  return new Promise((resolve) => {
    const empty: VideoProbe = { duration_sec: null, width: null, height: null, thumbnailBlob: null };
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    (video as HTMLVideoElement & { playsInline: boolean }).playsInline = true;

    const done = (result: VideoProbe) => {
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };

    const timeout = window.setTimeout(() => done(empty), 15000);

    video.onerror = () => {
      window.clearTimeout(timeout);
      done(empty);
    };

    video.onloadedmetadata = () => {
      const meta = {
        duration_sec: isFinite(video.duration) ? Math.round(video.duration) : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      };
      // Seek slightly into the clip so the poster frame is not a black lead-in.
      video.currentTime = Math.min(1, (video.duration || 1) / 2);
      video.onseeked = () => {
        window.clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, 640 / (video.videoWidth || 640));
          canvas.width = Math.round((video.videoWidth || 640) * scale);
          canvas.height = Math.round((video.videoHeight || 360) * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) return done({ ...meta, thumbnailBlob: null });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => done({ ...meta, thumbnailBlob: blob }), "image/jpeg", 0.75);
        } catch {
          done({ ...meta, thumbnailBlob: null });
        }
      };
    };

    video.src = objectUrl;
  });
}

export interface UploadResult {
  storage_path: string;
  public_url: string;
  thumbnail_path: string | null;
  thumbnail_url: string | null;
  file_size_mb: number;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  mime_type: string;
}

/** Uploads a video file (and generated poster frame) to the public media bucket. */
export async function uploadVideoFile(
  file: File,
  userId: string,
  onPhase?: (phase: string) => void
): Promise<UploadResult> {
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_UPLOAD_MB) {
    throw new Error(
      `Plik ma ${sizeMb.toFixed(0)} MB, a limit to ${MAX_UPLOAD_MB} MB. Wrzuć film na Mega.nz i dodaj go jako link.`
    );
  }

  onPhase?.("Analizowanie pliku...");
  const probe = await probeVideoFile(file);

  const stamp = Date.now();
  const base = `${VIDEO_PREFIX}/${userId}/${stamp}_${sanitizeFileName(file.name)}`;

  onPhase?.("Przesyłanie wideo...");
  const { error: uploadError } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(base, file, {
      contentType: file.type || "video/mp4",
      upsert: false,
      // Długi cache = mniej powtarzalnego transferu przy każdym podglądzie/publikacji.
      cacheControl: "31536000",
    });

  if (uploadError) throw new Error(`Upload nie powiódł się: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(base);

  let thumbnail_path: string | null = null;
  let thumbnail_url: string | null = null;
  if (probe.thumbnailBlob) {
    onPhase?.("Zapisywanie miniatury...");
    const thumbPath = `${VIDEO_PREFIX}/${userId}/thumbs/${stamp}.jpg`;
    const { error: thumbError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(thumbPath, probe.thumbnailBlob, { contentType: "image/jpeg", upsert: true });
    if (!thumbError) {
      thumbnail_path = thumbPath;
      thumbnail_url = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(thumbPath).data.publicUrl;
    }
  }

  return {
    storage_path: base,
    public_url: urlData.publicUrl,
    thumbnail_path,
    thumbnail_url,
    file_size_mb: Number(sizeMb.toFixed(2)),
    duration_sec: probe.duration_sec,
    width: probe.width,
    height: probe.height,
    mime_type: file.type || "video/mp4",
  };
}

/** Removes storage objects backing a library entry. Mega links have nothing to clean up. */
export async function deleteVideoAssets(video: LibraryVideo): Promise<void> {
  const paths = [video.storage_path, video.thumbnail_path].filter(Boolean) as string[];
  if (paths.length === 0) return;
  await supabase.storage.from(VIDEO_BUCKET).remove(paths);
}
