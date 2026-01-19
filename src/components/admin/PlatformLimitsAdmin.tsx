import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LimitInfo {
  type: string;
  name: string;
  limit_max: number;
  used: number;
  remaining: number;
  percentage_used: number;
  reset_at: string | null;
  source: 'api' | 'internal' | 'estimated';
}

interface AccountLimits {
  platform: string;
  account_id: string;
  account_name: string;
  limits: LimitInfo[];
  is_limited: boolean;
  total_published_today: number;
  total_published_month: number;
}

interface PlatformSummary {
  total_accounts: number;
  any_limited: boolean;
  total_published_today: number;
  total_published_month: number;
  total_remaining_today: number;
}

interface PlatformLimitsResponse {
  success: boolean;
  accounts: AccountLimits[];
  summary_by_platform: Record<string, PlatformSummary>;
  overall_summary: {
    total_accounts: number;
    any_limited: boolean;
    total_published_today: number;
    total_published_month: number;
    platforms_count: number;
  };
  platform_limits_config: Record<string, any>;
  fetched_at: string;
}

const platformIcons: Record<string, string> = {
  x: '𝕏',
  facebook: '📘',
  instagram: '📸',
  tiktok: '🎵',
  youtube: '▶️'
};

const platformNames: Record<string, string> = {
  x: 'X (Twitter)',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube'
};

const platformColors: Record<string, string> = {
  x: 'bg-black',
  facebook: 'bg-blue-600',
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  tiktok: 'bg-black',
  youtube: 'bg-red-600'
};

export function PlatformLimitsAdmin() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<PlatformLimitsResponse>({
    queryKey: ['admin-platform-limits'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('get-platform-limits');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const formatResetTime = (resetAt: string | null) => {
    if (!resetAt) return null;
    const reset = new Date(resetAt);
    const now = new Date();
    const diffMs = reset.getTime() - now.getTime();
    if (diffMs <= 0) return 'Teraz';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Wykorzystanie limitów API
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Wykorzystanie limitów API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Błąd ładowania limitów: {error instanceof Error ? error.message : 'Nieznany błąd'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data?.accounts || data.accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Wykorzystanie limitów API
          </CardTitle>
          <CardDescription>Brak połączonych kont social media</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Group accounts by platform
  const accountsByPlatform = data.accounts.reduce((acc, account) => {
    if (!acc[account.platform]) acc[account.platform] = [];
    acc[account.platform].push(account);
    return acc;
  }, {} as Record<string, AccountLimits[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Wykorzystanie limitów API
            </CardTitle>
            <CardDescription>
              Monitorowanie limitów publikacji dla wszystkich platform
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Odśwież
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Summary */}
        {data.overall_summary.any_limited && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Niektóre konta osiągnęły limit dzienny. Publikacje zostaną wznowione po resecie limitu.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-muted rounded-lg p-3">
            <div className="text-2xl font-bold">{data.overall_summary.total_accounts}</div>
            <div className="text-xs text-muted-foreground">Połączonych kont</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-2xl font-bold">{data.overall_summary.platforms_count}</div>
            <div className="text-xs text-muted-foreground">Platform</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-2xl font-bold">{data.overall_summary.total_published_today}</div>
            <div className="text-xs text-muted-foreground">Publikacji dziś</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-2xl font-bold">{data.overall_summary.total_published_month}</div>
            <div className="text-xs text-muted-foreground">Publikacji (30 dni)</div>
          </div>
        </div>

        {/* Platform sections */}
        <div className="space-y-4">
          {Object.entries(accountsByPlatform).map(([platform, accounts]) => {
            const summary = data.summary_by_platform[platform];
            
            return (
              <div key={platform} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{platformIcons[platform]}</span>
                    <span className="font-semibold">{platformNames[platform]}</span>
                    <Badge variant={summary?.any_limited ? "destructive" : "secondary"} className="text-xs">
                      {summary?.any_limited ? 'Limit' : 'OK'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {summary?.total_published_today || 0} dziś | {summary?.total_published_month || 0} (30d)
                  </div>
                </div>

                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div 
                      key={account.account_id} 
                      className={`rounded-lg p-3 ${account.is_limited ? 'bg-red-50 border border-red-200' : 'bg-muted/50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {platform === 'x' ? '@' : ''}{account.account_name}
                        </span>
                        {account.is_limited ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Limit osiągnięty
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        {account.limits.map((limit, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {limit.name}
                                {limit.source === 'api' && (
                                  <Badge variant="outline" className="ml-1 text-[10px] px-1">API</Badge>
                                )}
                              </span>
                              <span className={limit.remaining === 0 ? 'text-red-600 font-medium' : ''}>
                                {limit.used}/{limit.limit_max}
                                {limit.reset_at && (
                                  <span className="text-muted-foreground ml-2">
                                    Reset: {formatResetTime(limit.reset_at)}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="relative">
                              <Progress 
                                value={limit.percentage_used} 
                                className="h-2"
                              />
                              <div 
                                className={`absolute inset-0 h-2 rounded-full ${getProgressColor(limit.percentage_used)}`}
                                style={{ width: `${limit.percentage_used}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Last updated */}
        <div className="text-xs text-muted-foreground text-center">
          Ostatnia aktualizacja: {new Date(data.fetched_at).toLocaleString('pl-PL')}
        </div>
      </CardContent>
    </Card>
  );
}
