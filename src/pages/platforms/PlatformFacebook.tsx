import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Facebook, Sparkles } from "lucide-react";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { useToast } from "@/hooks/use-toast";

const PlatformFacebook = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Check for OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    const pageName = params.get('page_name');

    if (connected === 'true') {
      toast({
        title: "✅ Połączono z Facebook",
        description: pageName ? `Połączono jako strona: ${pageName}` : "Konto Facebook zostało pomyślnie połączone",
      });
      // Clean URL
      window.history.replaceState({}, '', '/platforms/facebook');
    } else if (error) {
      toast({
        title: "❌ Błąd połączenia Facebook",
        description: error,
        variant: "destructive"
      });
      // Clean URL
      window.history.replaceState({}, '', '/platforms/facebook');
    }
  }, [toast]);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("publish-to-facebook", {
        body: { testConnection: true }
      });

      if (error) throw error;

      const isConnected = data?.connected;
      
      toast({
        title: isConnected ? "✅ Połączenie z Facebook działa" : "❌ Brak połączenia z Facebook",
        description: isConnected 
          ? `Połączono jako: ${data.pageName || 'Unknown'}`
          : "Musisz najpierw połączyć konto Facebook w ustawieniach.",
        variant: isConnected ? "default" : "destructive"
      });
    } catch (error: any) {
      toast({
        title: "❌ Błąd testowania połączenia",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleConnectFacebook = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('facebook-oauth-start');
      
      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: "Błąd podczas łączenia z Facebook",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-gradient-primary shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/')}
                className="text-primary-foreground hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Facebook className="h-8 w-8 text-[#1877F2]" />
                <div>
                  <h1 className="text-3xl font-bold text-primary-foreground">Facebook</h1>
                  <p className="text-sm text-primary-foreground/90 mt-1">Zarządzaj publikacjami na Facebooku</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                {isTestingConnection ? "Testowanie..." : "Testuj połączenie"}
              </Button>
              <Button 
                onClick={handleConnectFacebook}
                className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
              >
                Połącz Facebook
              </Button>
              <Button
                onClick={() => navigate('/campaigns/new?platform=facebook')}
                className="gap-2 bg-white/10 text-white border-white/20 hover:bg-white/20"
                variant="outline"
              >
                <Sparkles className="h-4 w-4" />
                Kampania AI
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Connection Status */}
        <PlatformConnectionStatus 
          platform="facebook"
        />

        {/* Platform Stats */}
        <PlatformStats 
          platform="facebook"
        />

        {/* Analytics */}
        <PlatformAnalytics platform="facebook" />

        {/* Books List with Facebook-specific data */}
        <PlatformBooksList 
          platform="facebook"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </main>
    </div>
  );
};

export default PlatformFacebook;
