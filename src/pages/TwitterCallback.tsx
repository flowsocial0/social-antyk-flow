import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function TwitterCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Autoryzacja anulowana: ${error}`);
        setTimeout(() => navigate("/"), 3000);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("Brak kodu autoryzacyjnego");
        setTimeout(() => navigate("/"), 3000);
        return;
      }

      try {
        // Get code_verifier from sessionStorage
        const codeVerifier = sessionStorage.getItem("twitter_oauth_verifier");
        const storedState = sessionStorage.getItem("twitter_oauth_state");

        if (!codeVerifier) {
          throw new Error("Brak code_verifier - rozpocznij autoryzację ponownie");
        }

        if (state !== storedState) {
          throw new Error("State mismatch - możliwe naruszenie bezpieczeństwa");
        }

        const redirectUri = `${window.location.origin}/twitter-callback`;

        // Call callback function
        const { data, error: callbackError } = await supabase.functions.invoke(
          "twitter-oauth-callback",
          {
            body: { 
              code, 
              codeVerifier,
              state,
              redirectUri
            },
          }
        );

        if (callbackError) throw callbackError;

        // Clear stored OAuth data
        sessionStorage.removeItem("twitter_oauth_verifier");
        sessionStorage.removeItem("twitter_oauth_state");

        setStatus("success");
        setMessage(data.message || "Autoryzacja zakończona sukcesem!");
        
        setTimeout(() => navigate("/"), 2000);
      } catch (err: any) {
        console.error("Callback error:", err);
        setStatus("error");
        setMessage(err.message || "Wystąpił błąd podczas autoryzacji");
        setTimeout(() => navigate("/"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === "processing" && "Autoryzacja w toku..."}
            {status === "success" && "✅ Sukces!"}
            {status === "error" && "❌ Błąd"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "processing" && (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          )}
          <p className="text-center text-muted-foreground">{message}</p>
          {status !== "processing" && (
            <p className="text-sm text-muted-foreground">
              Przekierowywanie za chwilę...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
