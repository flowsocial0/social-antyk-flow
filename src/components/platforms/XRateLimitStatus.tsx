import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, CheckCircle2, RefreshCw, Loader2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface AccountRateLimit {
  id: string;
  screen_name: string | null;
  account_name: string | null;
  tweets: {
    limit_max: number;
    remaining: number;
    published_today: number;
    reset_at: string | null;
    is_limited: boolean;
    minutes_until_reset: number | null;
    updated_at: string | null;
    api_remaining?: number | null;
    api_reset_at?: string | null;
  };
}

interface RateLimitsResponse {
  success: boolean;
  accounts: AccountRateLimit[];
  summary: {
    total_accounts: number;
    any_limited: boolean;
    total_remaining: number;
    total_published_today: number;
    daily_limit: number;
    next_reset: string | null;
  };
  error?: string;
}

// Daily limit for X Free tier
const DAILY_TWEET_LIMIT = 17;

export function XRateLimitStatus() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<RateLimitsResponse>({
    queryKey: ["x-rate-limits"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          throw new Error("Not authenticated");
        }

        const { data, error } = await supabase.functions.invoke("get-x-rate-limits", {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });

        if (error) throw error;
        return data;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider data stale after 30s
    retry: 1,
    retryDelay: 1000,
    gcTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Limity X
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Limity X
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nie udało się pobrać informacji o limitach</p>
        </CardContent>
      </Card>
    );
  }

  if (!data.accounts || data.accounts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Limity X
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Brak połączonych kont X</p>
        </CardContent>
      </Card>
    );
  }

  const { accounts, summary } = data;
  const dailyLimit = summary.daily_limit || DAILY_TWEET_LIMIT;

  return (
    <Card className={summary.any_limited ? "border-yellow-500/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Limity X
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8 w-8 p-0">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {summary.any_limited && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span className="text-sm">
              Dzienny limit publikacji wyczerpany. Reset{" "}
              {summary.next_reset &&
                formatDistanceToNow(new Date(summary.next_reset), {
                  addSuffix: true,
                  locale: pl,
                })}
            </span>
          </div>
        )}

        {/* Per-account status */}
        <div className="space-y-3">
          {accounts.map((account) => {
            const tweets = account.tweets;
            const publishedToday = tweets.published_today || 0;
            const remaining = tweets.remaining;
            const max = tweets.limit_max || dailyLimit;
            const percentage = (remaining / max) * 100;
            const isLimited = tweets.is_limited;

            return (
              <div key={account.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">@{account.screen_name || "Unknown"}</span>
                  {isLimited ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Limit
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
                      <CheckCircle2 className="h-3 w-3" />
                      OK
                    </Badge>
                  )}
                </div>

                <Progress
                  value={percentage}
                  className={`h-2 ${isLimited ? "[&>div]:bg-red-500" : percentage < 30 ? "[&>div]:bg-yellow-500" : ""}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Opublikowano: {publishedToday}/{max} (pozostało: {remaining})
                  </span>
                  {tweets.reset_at && (
                    <span>
                      Reset:{" "}
                      {formatDistanceToNow(new Date(tweets.reset_at), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
          <p className="flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Limit X Free tier: {dailyLimit} tweetów/24h. 
              Liczba bazuje na faktycznych publikacjach z aplikacji.
            </span>
          </p>
          {summary.total_published_today > 0 && (
            <p className="text-muted-foreground/70">
              Łącznie opublikowano dziś: {summary.total_published_today} tweet(ów)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}