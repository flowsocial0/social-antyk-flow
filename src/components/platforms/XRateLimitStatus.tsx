import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, CheckCircle2, RefreshCw, Loader2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface RateLimitsResponse {
  success: boolean;
  appLimit: {
    remaining: number;
    limit: number;
    reset_at: string | null;
    is_limited: boolean;
    published_24h?: number;
  } | null;
  error?: string;
}

const APP_DAILY_LIMIT = 15;

function formatResetTime(resetAt: string | null): string | null {
  if (!resetAt) return null;
  
  const resetDate = new Date(resetAt);
  const now = Date.now();
  const diffMs = resetDate.getTime() - now;
  
  if (diffMs <= 0) {
    return "Limit powinien się odnowić — odśwież";
  }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  const exactTime = format(resetDate, "d MMM, HH:mm", { locale: pl });
  
  if (hours > 0) {
    return `${exactTime} (za ${hours}h ${minutes}min)`;
  }
  return `${exactTime} (za ${minutes}min)`;
}

export function XRateLimitStatus() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<RateLimitsResponse>({
    queryKey: ["x-app-rate-limit"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

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
        
        return {
          success: data?.success ?? false,
          appLimit: data?.appLimit ?? null,
          error: data?.error,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
    refetchInterval: 60000,
    staleTime: 30000,
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
            Limit aplikacji X
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
            Limit aplikacji X
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nie udało się pobrać informacji o limitach</p>
        </CardContent>
      </Card>
    );
  }

  const appLimit = data.appLimit;
  
  if (!appLimit) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Limit aplikacji X
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Brak danych o limicie aplikacji</p>
        </CardContent>
      </Card>
    );
  }

  const { remaining, limit, reset_at, is_limited } = appLimit;
  const percentage = limit > 0 ? (remaining / limit) * 100 : 0;
  const resetText = formatResetTime(reset_at);

  return (
    <Card className={is_limited ? "border-red-500/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Limit aplikacji X (24h)
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8 w-8 p-0">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {is_limited && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span className="text-sm">
              Dzienny limit aplikacji wyczerpany. Żaden użytkownik nie może publikować.
              {resetText && <> Reset: {resetText}</>}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Dostępne publikacje</span>
            {is_limited ? (
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
            className={`h-2 ${is_limited ? "[&>div]:bg-red-500" : percentage < 20 ? "[&>div]:bg-yellow-500" : ""}`}
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Pozostało: {remaining} z {limit}
            </span>
            {resetText && <span>Reset: {resetText}</span>}
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p className="flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Limit X Free tier: {APP_DAILY_LIMIT} publikacji/dzień dla całej aplikacji.
              Wszystkie konta użytkowników współdzielą ten limit.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
