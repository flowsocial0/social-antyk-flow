import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function ThreadsCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Przetwarzanie autoryzacji Threads...");

  useEffect(() => {
    // Threads OAuth callback is handled server-side (redirect from edge function)
    // This page is shown briefly if the user lands here directly
    const threadsStatus = searchParams.get('threads');
    const errorMessage = searchParams.get('message');

    if (threadsStatus === 'connected') {
      setStatus('success');
      setMessage('Konto Threads zostało połączone!');
      setTimeout(() => navigate('/settings/social-accounts?threads=connected'), 2000);
    } else if (threadsStatus === 'error') {
      setStatus('error');
      setMessage(errorMessage || 'Wystąpił błąd podczas łączenia z Threads');
      setTimeout(() => navigate('/settings/social-accounts'), 3000);
    } else if (threadsStatus === 'cancelled') {
      setStatus('error');
      setMessage('Autoryzacja Threads została anulowana');
      setTimeout(() => navigate('/settings/social-accounts'), 3000);
    } else {
      // If no status params, redirect to social accounts
      setTimeout(() => navigate('/settings/social-accounts'), 2000);
    }
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
            <p className="text-sm text-muted-foreground">Przekierowywanie za chwilę...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
