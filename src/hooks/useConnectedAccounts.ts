import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAllPlatforms, PlatformId } from "@/config/platforms";

/** Single source of truth: platform id -> OAuth/token table holding that user's accounts. */
export const PLATFORM_TOKEN_TABLES: Record<string, string> = {
  x: "twitter_oauth1_tokens",
  facebook: "facebook_oauth_tokens",
  instagram: "instagram_oauth_tokens",
  tiktok: "tiktok_oauth_tokens",
  youtube: "youtube_oauth_tokens",
  linkedin: "linkedin_oauth_tokens",
  telegram: "telegram_tokens",
  bluesky: "bluesky_tokens",
  mastodon: "mastodon_tokens",
  discord: "discord_tokens",
  tumblr: "tumblr_oauth_tokens",
  google_business: "google_business_tokens",
};

export interface ConnectedAccountsState {
  connectedPlatforms: Record<PlatformId, boolean>;
  accountCounts: Record<PlatformId, number>;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Counts the signed-in user's connected accounts per platform.
 * Every query filters explicitly by user_id — admin RLS policies would otherwise
 * expose other users' tokens and falsely mark a platform as connected.
 */
export const useConnectedAccounts = (): ConnectedAccountsState => {
  const [accountCounts, setAccountCounts] = useState<Record<PlatformId, number>>({} as Record<PlatformId, number>);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setAccountCounts({} as Record<PlatformId, number>);
      setLoading(false);
      return;
    }

    const platforms = getAllPlatforms();
    const results = await Promise.all(
      platforms.map(async (platform) => {
        const table = PLATFORM_TOKEN_TABLES[platform.id];
        if (!table) return { id: platform.id, count: 0 };
        const { count, error } = await (supabase as any)
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id);
        if (error) {
          console.error(`Nie udało się sprawdzić kont dla ${platform.id}:`, error.message);
          return { id: platform.id, count: 0 };
        }
        return { id: platform.id, count: count ?? 0 };
      })
    );

    const counts: Record<string, number> = {};
    results.forEach((r) => {
      counts[r.id] = r.count;
    });

    setAccountCounts(counts as Record<PlatformId, number>);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connectedPlatforms = Object.fromEntries(
    Object.entries(accountCounts).map(([id, count]) => [id, count > 0])
  ) as Record<PlatformId, boolean>;

  return { connectedPlatforms, accountCounts, loading, refresh };
};
