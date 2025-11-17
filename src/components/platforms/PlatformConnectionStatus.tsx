import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Link as LinkIcon } from "lucide-react";

interface PlatformConnectionStatusProps {
  platform: string;
  onConnect?: () => void;
}

export const PlatformConnectionStatus = ({ platform, onConnect }: PlatformConnectionStatusProps) => {
  const { toast } = useToast();

  const { data: tokenData, isLoading } = useQuery({
    queryKey: ["oauth-token", platform],
    queryFn: async () => {
      const tableName = platform === "x" ? "twitter_oauth_tokens" : `${platform}_oauth_tokens`;
      const { data, error } = await (supabase as any)
        .from(tableName)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const functionName = platform === "x" ? "publish-to-x" : `publish-to-${platform}`;
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { testConnection: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const isOk = !!(data?.connected ?? data?.success ?? data?.oauth1?.ok ?? data?.oauth2?.ok);
      const pageName = data?.pageName || data?.page_name;
      toast({
        title: isOk ? "✅ Połączenie działa" : "❌ Problem z połączeniem",
        description: isOk ? (pageName ? `Połączono jako: ${pageName}` : "Konto jest prawidłowo połączone") : "Sprawdź ustawienia połączenia",
        variant: isOk ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Błąd testu połączenia",
        description: error.message || "Nie udało się przetestować połączenia",
        variant: "destructive",
      });
    },
  });

  const handleConnect = async () => {
    if (onConnect) {
      onConnect();
    } else if (platform === "x" || platform === "facebook") {
      // Start OAuth flow
      window.location.href = "/settings/social-accounts";
    } else {
      toast({
        title: "Wkrótce",
        description: `Połączenie z ${platform} będzie dostępne wkrótce`,
      });
    }
  };

  const isConnected = !!tokenData;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status połączenia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Status połączenia
          {isConnected ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Połączono
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Nie połączono
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Konto zostało autoryzowane i jest gotowe do publikacji
              </p>
              {tokenData?.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Token wygasa:{" "}
                  {new Date(tokenData.expires_at).toLocaleDateString("pl-PL")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending}
              >
                {testConnectionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testowanie...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Test połączenia
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Zarządzaj
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Połącz swoje konto, aby rozpocząć publikację
            </p>
            <Button onClick={handleConnect}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Połącz konto
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
