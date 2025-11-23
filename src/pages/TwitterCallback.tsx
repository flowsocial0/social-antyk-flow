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
      const oauthToken = searchParams.get('oauth_token');
      const oauthVerifier = searchParams.get('oauth_verifier');
      const denied = searchParams.get('denied');

      // Get stored state from session storage
      const storedState = sessionStorage.getItem('twitter_oauth1_state');

      console.log('Twitter OAuth 1.0a callback received:', { oauthToken, oauthVerifier, denied });
      console.log('Stored state:', storedState);

      if (denied) {
        setStatus('error');
        setMessage('Autoryzacja została anulowana');
        
        // Clear stored data
        sessionStorage.removeItem('twitter_oauth1_state');
        
        setTimeout(() => navigate('/platforms/x'), 3000);
        return;
      }

      if (!oauthToken || !oauthVerifier) {
        setStatus('error');
        setMessage('Brak parametrów OAuth');
        setTimeout(() => navigate('/platforms/x'), 3000);
        return;
      }

      if (!storedState) {
        setStatus('error');
        setMessage('Brak state - możliwy timeout sesji');
        setTimeout(() => navigate('/platforms/x'), 3000);
        return;
      }

      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Musisz być zalogowany');
        }

        console.log('Calling twitter-oauth1-callback edge function...');
        
        // Call the OAuth 1.0a callback edge function
        const { data, error: callbackError } = await supabase.functions.invoke(
          'twitter-oauth1-callback',
          {
            body: { 
              oauthToken,
              oauthVerifier,
              state: storedState
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          }
        );

        console.log('Callback response:', data, callbackError);

        if (callbackError) {
          throw callbackError;
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Nie udało się zakończyć OAuth flow');
        }

        // Clear stored data on success
        sessionStorage.removeItem('twitter_oauth1_state');

        setStatus('success');
        setMessage(`Konto X (@${data.screen_name}) zostało połączone!`);
        
        // Redirect to platform page after 2 seconds
        setTimeout(() => navigate('/platforms/x'), 2000);
      } catch (err: any) {
        console.error('Error in Twitter OAuth 1.0a callback:', err);
        setStatus('error');
        setMessage(err.message || 'Wystąpił błąd podczas autoryzacji');
        
        setTimeout(() => navigate('/platforms/x'), 3000);
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
