import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Link as LinkIcon, Unplug } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PlatformConnectionStatusProps {
  platform: string;
  onConnect?: () => void;
}

interface AccountInfo {
  id: string;
  name: string;
  expires_at?: string;
}

export const PlatformConnectionStatus = ({ platform, onConnect }: PlatformConnectionStatusProps) => {
  const { toast } = useToast();

  const getTableName = (platform: string): string => {
    if (platform === "x") return "twitter_oauth1_tokens";
    if (platform === "telegram") return "telegram_tokens";
    if (platform === "bluesky") return "bluesky_tokens";
    if (platform === "pinterest") return "pinterest_oauth_tokens";
    
    if (platform === "discord") return "discord_tokens";
    if (platform === "tumblr") return "tumblr_oauth_tokens";
    if (platform === "google_business") return "google_business_tokens";
    if (platform === "google_business") return "google_business_tokens";
    if (platform === "mastodon") return "mastodon_tokens";
    
    return `${platform}_oauth_tokens`;
  };

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ["oauth-tokens", platform],
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async (): Promise<AccountInfo[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const tableName = getTableName(platform);
      let query = (supabase as any)
        .from(tableName)
        .select("*")
        .eq("user_id", session.user.id);

      // Filter out pending tokens for mastodon
      if (platform === "mastodon") {
        query = query.not("access_token", "like", "pending_%");
      }

      const { data, error } = await query;

      if (error && error.code !== "PGRST116") throw error;
      if (!data || data.length === 0) return [];

      // Map to account info based on platform
      return data.map((token: any) => {
        let name = "Konto";
        if (platform === "x") name = token.screen_name ? `@${token.screen_name}` : "Konto X";
        else if (platform === "facebook") name = token.page_name || "Strona Facebook";
        else if (platform === "instagram") name = token.instagram_username ? `@${token.instagram_username}` : "Konto Instagram";
        else if (platform === "tiktok") name = token.account_name || token.open_id?.substring(0, 8) || "Konto TikTok";
        else if (platform === "youtube") name = token.channel_title || "Kanał YouTube";
        else if (platform === "linkedin") name = token.display_name || "Profil LinkedIn";
        else if (platform === "telegram") name = token.channel_name || token.chat_id || "Kanał Telegram";
        else if (platform === "bluesky") name = token.handle || "Konto Bluesky";
        else if (platform === "pinterest") name = token.username ? `@${token.username}` : "Konto Pinterest";
        
        else if (platform === "discord") name = token.channel_name || "Kanał Discord";
        else if (platform === "tumblr") name = token.blog_name || token.username || "Blog Tumblr";
        else if (platform === "google_business") name = token.business_name || "Firma Google";
        else if (platform === "google_business") name = token.business_name || "Firma Google";
        else if (platform === "mastodon") name = token.username ? `@${token.username}@${(token.server_url || '').replace('https://', '')}` : "Konto Mastodon";


        return {
          id: token.id,
          name,
          expires_at: token.expires_at,
        };
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Musisz być zalogowany');

      // Test connection for all accounts by calling the function
      // The function will report how many accounts are connected
      const functionName = platform === "x" ? "publish-to-x" : `publish-to-${platform}`;
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { testConnection: true },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const isOk = !!(data?.connected ?? data?.success ?? data?.oauth1?.ok ?? data?.oauth2?.ok);
      const accountCount = accounts?.length || 0;
      const pageName = data?.pageName || data?.page_name || data?.username || data?.name;
      
      toast({
        title: isOk 
          ? `✅ Połączono ${accountCount} ${accountCount === 1 ? 'konto' : 'kont'}`
          : "❌ Problem z połączeniem",
        description: isOk 
          ? (pageName ? `Testowano: ${pageName}` : `${accountCount} kont połączonych`) 
          : "Sprawdź ustawienia połączenia",
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

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Musisz być zalogowany');

      const tableName = getTableName(platform);
      const { error } = await (supabase as any)
        .from(tableName)
        .delete()
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "✅ Rozłączono",
        description: "Konto zostało rozłączone. Przy ponownym połączeniu zostaniesz poproszony o wszystkie uprawnienia.",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "❌ Błąd",
        description: error.message || "Nie udało się rozłączyć konta",
        variant: "destructive",
      });
    },
  });

  const handleConnect = async () => {
    if (onConnect) {
      onConnect();
    } else if (["x", "facebook", "tiktok", "instagram", "youtube", "linkedin", "telegram", "bluesky", "pinterest", "discord", "tumblr", "google_business", "mastodon"].includes(platform)) {
      window.location.href = `/settings/social-accounts#${platform}`;
    } else {
      toast({
        title: "Wkrótce",
        description: `Połączenie z ${platform} będzie dostępne wkrótce`,
      });
    }
  };

  const accountCount = accounts?.length || 0;
  const isConnected = accountCount > 0;

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
              {accountCount} {accountCount === 1 ? 'konto' : 'kont'}
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
              <div className="flex flex-wrap gap-2">
                {accounts?.map((account) => (
                  <Badge key={account.id} variant="secondary" className="text-xs">
                    {account.name}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Publikacja trafi na wszystkie połączone konta
              </p>
              {accounts?.some(a => a.expires_at && new Date(a.expires_at) < new Date()) && (
                <p className="text-xs text-destructive">
                  ⚠️ Niektóre tokeny wygasły - odśwież połączenie
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Unplug className="h-4 w-4 mr-2" />
                    )}
                    Rozłącz
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rozłączyć wszystkie konta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Usunie to wszystkie zapisane tokeny autoryzacji dla tej platformy. 
                      Przy ponownym połączeniu zostaniesz poproszony o udzielenie wszystkich uprawnień od nowa.
                      Zaplanowane posty na tę platformę nie będą mogły być opublikowane do czasu ponownego połączenia.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => disconnectMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Tak, rozłącz
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
