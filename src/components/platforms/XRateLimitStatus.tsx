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
    limit_max: number | null;
    remaining: number | null;
    reset_at: string | null;
    is_limited: boolean;
    minutes_until_reset: number | null;
    updated_at: string | null;
  } | null;
}

interface RateLimitsResponse {
  success: boolean;
  accounts: AccountRateLimit[];
  summary: {
    total_accounts: number;
    any_limited: boolean;
    total_remaining: number;
    next_reset: string | null;
  };
  error?: string;
}

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
            Limity API X
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
            Limity API X
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
            Limity API X
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Brak połączonych kont X</p>
        </CardContent>
      </Card>
    );
  }

  const { accounts, summary } = data;

  return (
    <Card className={summary.any_limited ? "border-yellow-500/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Limity API X
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
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">
              Limit przekroczony. Reset{" "}
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
            const remaining = tweets?.remaining ?? 0;
            const max = tweets?.limit_max ?? 50; // Default to 50 if unknown
            const percentage = max > 0 ? (remaining / max) * 100 : 100;
            const isLimited = tweets?.is_limited ?? false;
            const hasData = tweets !== null;

            return (
              <div key={account.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">@{account.screen_name || "Unknown"}</span>
                  {isLimited ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Limit
                    </Badge>
                  ) : hasData ? (
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
                      <CheckCircle2 className="h-3 w-3" />
                      OK
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Brak danych</Badge>
                  )}
                </div>

                {hasData ? (
                  <>
                    <Progress
                      value={percentage}
                      className={`h-2 ${isLimited ? "[&>div]:bg-red-500" : percentage < 20 ? "[&>div]:bg-yellow-500" : ""}`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {remaining}/{max} tweetów
                      </span>
                      {tweets?.reset_at && (
                        <span>
                          Reset:{" "}
                          {formatDistanceToNow(new Date(tweets.reset_at), {
                            addSuffix: true,
                            locale: pl,
                          })}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    <span>Limity zaktualizują się po pierwszej publikacji</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Limit X: 10 tweetów/dzień. Limit resetuje się co 24h.
        </p>
      </CardContent>
    </Card>
  );
}
