import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function TikTokCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Przetwarzanie autoryzacji TikTok...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        console.error("TikTok OAuth error:", error, errorDescription);
        toast.error("Błąd autoryzacji TikTok", {
          description: errorDescription || error,
        });
        navigate("/platforms/tiktok");
        return;
      }

      if (!code) {
        toast.error("Brak kodu autoryzacji");
        navigate("/platforms/tiktok");
        return;
      }

      // Verify state
      const savedState = sessionStorage.getItem("tiktok_oauth_state");
      if (state !== savedState) {
        console.error("State mismatch:", { received: state, saved: savedState });
        toast.error("Błąd weryfikacji stanu OAuth");
        navigate("/platforms/tiktok");
        return;
      }

      // Get saved data from session storage
      const codeVerifier = sessionStorage.getItem("tiktok_code_verifier");
      const userId = sessionStorage.getItem("tiktok_user_id");
      const redirectUri = `${window.location.origin}/oauth/tiktok/callback`;

      if (!codeVerifier || !userId) {
        toast.error("Brak danych sesji OAuth");
        navigate("/platforms/tiktok");
        return;
      }

      setStatus("Wymieniamy kod na token dostępu...");

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "tiktok-oauth-callback",
          {
            body: { code, codeVerifier, userId, redirectUri },
          }
        );

        if (fnError) throw fnError;

        if (data?.success) {
          // Clean up session storage
          sessionStorage.removeItem("tiktok_oauth_state");
          sessionStorage.removeItem("tiktok_code_verifier");
          sessionStorage.removeItem("tiktok_user_id");

          toast.success("TikTok połączony pomyślnie!");
          navigate("/platforms/tiktok");
        } else {
          throw new Error(data?.error || "Nieznany błąd");
        }
      } catch (error: any) {
        console.error("TikTok callback error:", error);
        toast.error("Błąd połączenia z TikTok", {
          description: error.message,
        });
        navigate("/platforms/tiktok");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
        <p className="text-lg text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
