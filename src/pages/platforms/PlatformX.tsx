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
      console.log("Starting X OAuth flow...");
      const redirectUri = `${window.location.origin}/twitter-callback`;
      console.log("Redirect URI:", redirectUri);
      
      const { data, error } = await supabase.functions.invoke('twitter-oauth-start', {
        body: { redirectUri }
      });
      
      console.log("OAuth response:", data, error);
      
      if (error) throw error;
      
      if (data?.authUrl) {
        // Store code verifier for callback
        if (data.codeVerifier) {
          sessionStorage.setItem('twitter_code_verifier', data.codeVerifier);
        }
        if (data.state) {
          sessionStorage.setItem('twitter_state', data.state);
        }
        console.log("Redirecting to:", data.authUrl);
        window.location.href = data.authUrl;
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (error: any) {
      console.error("Error connecting X:", error);
      toast({
        title: "Błąd podczas łączenia z X",
        description: error.message,
        variant: "destructive"
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
