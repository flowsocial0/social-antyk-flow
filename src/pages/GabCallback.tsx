import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function GabCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Łączenie z Gab...");

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      let userId = sessionStorage.getItem("gab_user_id");

      if (!code) {
        toast.error("Brak kodu autoryzacji");
        navigate("/platforms/gab");
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
        navigate("/platforms/gab");
        return;
      }

      try {
        setStatus("Wymienianie kodu na token...");
        const redirectUri = `${window.location.origin}/oauth/gab/callback`;

        const { data, error } = await supabase.functions.invoke("gab-oauth-callback", {
          body: { code, userId, redirectUri },
        });

        if (error) throw error;

        if (data?.success) {
          toast.success("Połączono z Gab!", {
            description: data.username ? `@${data.username}` : undefined,
          });
        } else {
          throw new Error(data?.error || "Nieznany błąd");
        }
      } catch (error: any) {
        toast.error("Błąd połączenia z Gab", { description: error.message });
      } finally {
        sessionStorage.removeItem("gab_user_id");
        sessionStorage.removeItem("gab_oauth_state");
        navigate("/platforms/gab");
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
