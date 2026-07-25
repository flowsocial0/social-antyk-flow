import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LibraryVideo } from "@/lib/videoLibrary";

export function useVideoLibrary() {
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await (supabase as any)
      .from("video_library")
      .select("*")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Video library load error:", queryError);
      setError(queryError.message);
      setVideos([]);
    } else {
      setVideos((data || []) as LibraryVideo[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => v.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [videos]);

  return { videos, loading, error, reload: load, allTags };
}

export type VideoSortKey = "newest" | "oldest" | "title" | "most_used";

export function filterAndSortVideos(
  videos: LibraryVideo[],
  search: string,
  sourceFilter: "all" | "supabase_upload" | "mega_link",
  tagFilter: string,
  sort: VideoSortKey
): LibraryVideo[] {
  const term = search.trim().toLowerCase();

  const filtered = videos.filter((v) => {
    if (sourceFilter !== "all" && v.source_type !== sourceFilter) return false;
    if (tagFilter !== "all" && !v.tags.includes(tagFilter)) return false;
    if (!term) return true;
    return (
      v.title.toLowerCase().includes(term) ||
      (v.description || "").toLowerCase().includes(term) ||
      v.tags.some((t) => t.toLowerCase().includes(term))
    );
  });

  const sorted = [...filtered];
  switch (sort) {
    case "oldest":
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      break;
    case "title":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "pl"));
      break;
    case "most_used":
      sorted.sort((a, b) => b.usage_count - a.usage_count);
      break;
    default:
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return sorted;
}
