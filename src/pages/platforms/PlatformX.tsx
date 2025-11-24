import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Twitter, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PlatformX() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const handleConnectX = async () => {
    try {
      console.log("=== Starting X OAuth 1.0a flow ===");
      
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("No session found");
        toast({
          title: "Musisz być zalogowany",
          description: "Zaloguj się, aby połączyć konto X",
          variant: "destructive"
        });
        return;
      }
      console.log("User session OK, user ID:", session.user.id);

      const redirectUri = `${window.location.origin}/twitter-callback`;
      console.log("Redirect URI:", redirectUri);
      
      toast({
        title: "Łączenie z X...",
        description: "Poczekaj chwilę, inicjalizujemy połączenie..."
      });

      // Call OAuth 1.0a start endpoint
      console.log("Calling twitter-oauth1-start edge function...");
      const { data, error } = await supabase.functions.invoke('twitter-oauth1-start', {
        body: { redirectUri },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      console.log("=== Edge function response ===");
      console.log("Data:", JSON.stringify(data, null, 2));
      console.log("Error:", error);
      
      if (error) {
        console.error("Edge function error:", error);
        throw new Error(`Edge function error: ${error.message || JSON.stringify(error)}`);
      }

      if (!data) {
        console.error("No data received from edge function");
        throw new Error("Nie otrzymano odpowiedzi z serwera. Sprawdź logi edge function.");
      }
      
      if (data.error) {
        console.error("Error in data:", data.error);
        throw new Error(data.error);
      }
      
      if (!data.authUrl) {
        console.error("No authUrl in response:", data);
        throw new Error("Nie otrzymano adresu autoryzacji. Sprawdź konfigurację Twitter Developer Portal.");
      }

      if (!data.state) {
        console.error("No state in response:", data);
        throw new Error("Brak parametru state. To może wskazywać na problem z edge function.");
      }

      // Store state for callback verification
      sessionStorage.setItem('twitter_oauth1_state', data.state);
      console.log("State saved to sessionStorage:", data.state);
      console.log("Redirecting to X authorization:", data.authUrl);
      
      window.location.href = data.authUrl;
    } catch (error: any) {
      console.error("=== Error connecting X ===", error);
      
      let errorMessage = error.message || "Nieznany błąd";
      let errorTitle = "Błąd podczas łączenia z X";
      
      // Provide more specific error messages
      if (errorMessage.includes("Missing Twitter OAuth credentials")) {
        errorTitle = "Brak konfiguracji Twitter API";
        errorMessage = "Skonfiguruj TWITTER_CONSUMER_KEY i TWITTER_CONSUMER_SECRET w Supabase Secrets.";
      } else if (errorMessage.includes("Failed to get request token")) {
        errorTitle = "Błąd pobierania request token";
        errorMessage = "Sprawdź czy Callback URL w Twitter Developer Portal to: " + window.location.origin + "/twitter-callback";
      } else if (errorMessage.includes("Edge function error")) {
        errorTitle = "Błąd edge function";
        errorMessage = "Sprawdź logi edge function twitter-oauth1-start w Supabase Dashboard.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
        duration: 10000
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Twitter className="h-8 w-8 text-[#1DA1F2]" />
              <div>
                <h1 className="text-3xl font-bold">X (Twitter)</h1>
                <p className="text-muted-foreground">Zarządzaj publikacjami na X</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => navigate('/campaigns/new?platform=x')}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Stwórz kampanię AI
          </Button>
        </div>

        {/* Connection Status & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="x" onConnect={handleConnectX} />
          <PlatformStats platform="x" />
        </div>

        {/* Analytics */}
        <PlatformAnalytics platform="x" />

        {/* Books List */}
        <Card className="p-6">
          <PlatformBooksList 
            platform="x"
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </Card>
      </div>
    </div>
  );
}
