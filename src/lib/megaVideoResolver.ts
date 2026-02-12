import { File as MegaFile } from "megajs";
import { supabase } from "@/integrations/supabase/client";

const MEGA_URL_REGEX = /^https?:\/\/mega\.nz\/(file|folder)\//;

export function isMegaUrl(url: string): boolean {
  return MEGA_URL_REGEX.test(url);
}

/**
 * If videoUrl is a Mega.nz link, downloads & decrypts it in the browser,
 * uploads to a temp path in Supabase Storage, and returns the public URL.
 * Returns a cleanup function to delete the temp file after publishing.
 * If not a Mega URL, returns the original URL with a no-op cleanup.
 */
export async function resolveMegaVideo(
  videoUrl: string,
  bookId: string,
  onProgress?: (phase: string) => void
): Promise<{ resolvedUrl: string; cleanup: () => Promise<void> }> {
  if (!isMegaUrl(videoUrl)) {
    return { resolvedUrl: videoUrl, cleanup: async () => {} };
  }

  const tempPath = `temp-videos/${bookId}-${Date.now()}.mp4`;

  try {
    // Phase 1: Download from Mega (decrypt in browser)
    onProgress?.("Pobieranie z Mega.nz...");
    const file = MegaFile.fromURL(videoUrl);
    await file.loadAttributes();
    const buffer = await file.downloadBuffer({});

    // Phase 2: Upload to temp Storage
    onProgress?.("Przesyłanie tymczasowego pliku...");
    const uint8 = new Uint8Array(buffer as unknown as ArrayBuffer);
    const blob = new Blob([uint8], { type: "video/mp4" });
    const { error: uploadError } = await supabase.storage
      .from("ObrazkiKsiazek")
      .upload(tempPath, blob, { upsert: true });

    if (uploadError) {
      throw new Error(`Upload tymczasowy nie powiódł się: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("ObrazkiKsiazek")
      .getPublicUrl(tempPath);

    const resolvedUrl = urlData.publicUrl;

    // Cleanup function to delete temp file after publishing
    const cleanup = async () => {
      try {
        await supabase.storage.from("ObrazkiKsiazek").remove([tempPath]);
        console.log("Temp video deleted:", tempPath);
      } catch (err) {
        console.warn("Failed to delete temp video:", tempPath, err);
      }
    };

    return { resolvedUrl, cleanup };
  } catch (err: any) {
    // Try to clean up on error too
    try {
      await supabase.storage.from("ObrazkiKsiazek").remove([tempPath]);
    } catch {}
    throw new Error(`Mega.nz: ${err.message || "Nie udało się pobrać wideo"}`);
  }
}
