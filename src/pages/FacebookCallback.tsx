import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function FacebookCallback() {
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
        setTimeout(() => navigate("/platforms/facebook"), 3000);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("Brak kodu autoryzacyjnego");
        setTimeout(() => navigate("/platforms/facebook"), 3000);
        return;
      }

      try {
        // Get stored state and user_id from sessionStorage
        const storedState = sessionStorage.getItem("facebook_state");
        const userId = sessionStorage.getItem("facebook_user_id");

        if (state !== storedState || !userId) {
          throw new Error("State mismatch lub brak user_id");
        }

        // Facebook edge function will handle the rest via GET redirect
        // It will be called directly by Facebook with the code
        setStatus("success");
        setMessage("Konto Facebook zostało pomyślnie połączone!");
        
        // Clear stored OAuth data
        sessionStorage.removeItem("facebook_state");
        sessionStorage.removeItem("facebook_user_id");
        
        setTimeout(() => navigate("/platforms/facebook?connected=true"), 2000);
      } catch (err: any) {
        console.error("Facebook callback error:", err);
        setStatus("error");
        setMessage(err.message || "Wystąpił błąd podczas autoryzacji");
        setTimeout(() => navigate("/platforms/facebook"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === "processing" && "Łączenie z Facebook..."}
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