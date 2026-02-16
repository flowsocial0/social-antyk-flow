import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function MastodonCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Łączenie z Mastodon...");

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");

      const savedState = sessionStorage.getItem("mastodon_oauth_state");
      let serverUrl = sessionStorage.getItem("mastodon_server_url");
      let userId = sessionStorage.getItem("mastodon_user_id");

      if (!code) {
        toast.error("Brak kodu autoryzacji");
        navigate("/settings/social-accounts");
        return;
      }

      if (state && savedState && state !== savedState) {
        toast.error("Nieprawidłowy state - spróbuj ponownie");
        navigate("/settings/social-accounts");
        return;
      }

      // Fallback: get userId from Supabase auth session
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          userId = session.user.id;
        }
      }

      if (!userId) {
        toast.error("Brak danych sesji - spróbuj ponownie");
        navigate("/settings/social-accounts");
        return;
      }

      // Fallback: get serverUrl from pending token in database
      if (!serverUrl) {
        try {
          const { data: pendingToken } = await supabase.functions.invoke("mastodon-oauth-callback", {
            body: { lookupServerUrl: true, userId, state },
          });
          if (pendingToken?.serverUrl) {
            serverUrl = pendingToken.serverUrl;
          }
        } catch (_) {
          // ignore, will fail below
        }
      }

      if (!serverUrl) {
        toast.error("Brak danych serwera Mastodon - spróbuj ponownie");
        navigate("/settings/social-accounts");
        return;
      }

      try {
        setStatus("Wymienianie kodu na token...");
        const redirectUri = `${window.location.origin}/oauth/mastodon/callback`;

        const { data, error } = await supabase.functions.invoke("mastodon-oauth-callback", {
          body: { code, state, serverUrl, userId, redirectUri },
        });

        if (error) throw error;

        if (data?.success) {
          toast.success("Połączono z Mastodon!", {
            description: data.username ? `@${data.username}` : undefined,
          });
        } else {
          throw new Error(data?.error || "Nieznany błąd");
        }
      } catch (error: any) {
        toast.error("Błąd połączenia z Mastodon", { description: error.message });
      } finally {
        sessionStorage.removeItem("mastodon_oauth_state");
        sessionStorage.removeItem("mastodon_server_url");
        sessionStorage.removeItem("mastodon_user_id");
        navigate("/settings/social-accounts#mastodon");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
