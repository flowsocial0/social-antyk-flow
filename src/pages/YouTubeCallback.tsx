import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Youtube } from "lucide-react";

const YouTubeCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Przetwarzanie autoryzacji YouTube...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
          throw new Error(`YouTube authorization failed: ${error}`);
        }

        if (!code) {
          throw new Error("No authorization code received");
        }

        // Verify state
        const savedState = sessionStorage.getItem("youtube_oauth_state");
        if (state !== savedState) {
          console.warn("State mismatch, but continuing...");
        }

        setMessage("Wymieniamy kod na token dostępu...");

        // Get redirect URI
        const redirectUri = `${window.location.origin}/oauth/youtube/callback`;

        // Exchange code for tokens
        const { data, error: callbackError } = await supabase.functions.invoke(
          "youtube-oauth-callback",
          {
            body: { code, redirectUri },
          }
        );

        if (callbackError) {
          throw new Error(callbackError.message);
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        // Clear session storage
        sessionStorage.removeItem("youtube_oauth_state");

        setStatus("success");
        setMessage(`Połączono z kanałem: ${data.channelTitle || "YouTube"}`);
        toast.success("Pomyślnie połączono konto YouTube!");

        // Redirect after short delay
        setTimeout(() => {
          navigate("/platforms/youtube");
        }, 2000);
      } catch (err) {
        console.error("YouTube callback error:", err);
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Wystąpił błąd podczas autoryzacji");
        toast.error("Błąd podczas łączenia konta YouTube");

        // Redirect after showing error
        setTimeout(() => {
          navigate("/platforms/youtube");
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
      <div className="bg-card p-8 rounded-lg shadow-lg border border-border max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className={`p-4 rounded-full ${
            status === "processing" ? "bg-red-500/20" :
            status === "success" ? "bg-green-500/20" :
            "bg-destructive/20"
          }`}>
            {status === "processing" ? (
              <Loader2 className="h-12 w-12 text-red-500 animate-spin" />
            ) : (
              <Youtube className={`h-12 w-12 ${
                status === "success" ? "text-green-500" : "text-destructive"
              }`} />
            )}
          </div>
        </div>
        
        <h1 className="text-2xl font-bold mb-2">
          {status === "processing" ? "Łączenie z YouTube" :
           status === "success" ? "Połączono!" :
           "Błąd połączenia"}
        </h1>
        
        <p className="text-muted-foreground">{message}</p>
        
        {status !== "processing" && (
          <p className="text-sm text-muted-foreground mt-4">
            Za chwilę nastąpi przekierowanie...
          </p>
        )}
      </div>
    </div>
  );
};

export default YouTubeCallback;
