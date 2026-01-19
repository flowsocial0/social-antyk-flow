import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LinkedInCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Przetwarzanie autoryzacji LinkedIn...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        setStatus("error");
        setMessage(`Autoryzacja anulowana: ${errorDescription || error}`);
        setTimeout(() => navigate("/platforms/linkedin"), 3000);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("Brak kodu autoryzacyjnego");
        setTimeout(() => navigate("/platforms/linkedin"), 3000);
        return;
      }

      try {
        // Get stored state and user_id from sessionStorage
        const storedState = sessionStorage.getItem("linkedin_state");
        const userId = sessionStorage.getItem("linkedin_user_id");

        if (state !== storedState || !userId) {
          throw new Error("State mismatch lub brak user_id");
        }

        // The edge function callback handles everything via GET redirect
        // This page is only shown if user lands here directly
        setStatus("success");
        setMessage("Konto LinkedIn zostało pomyślnie połączone!");
        
        // Clear stored OAuth data
        sessionStorage.removeItem("linkedin_state");
        sessionStorage.removeItem("linkedin_user_id");
        
        setTimeout(() => navigate("/settings/social-accounts?connected=true&platform=linkedin"), 2000);
      } catch (err: any) {
        console.error("LinkedIn callback error:", err);
        setStatus("error");
        setMessage(err.message || "Wystąpił błąd podczas autoryzacji");
        setTimeout(() => navigate("/platforms/linkedin"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === "processing" && "Łączenie z LinkedIn..."}
            {status === "success" && "✅ Połączono!"}
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
