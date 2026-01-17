import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Copy } from "lucide-react";
import { CampaignBuilder } from "@/components/campaigns/CampaignBuilder";
import { Footer } from "@/components/layout/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { User } from "@supabase/supabase-js";
import type { CampaignConfig } from "@/components/campaigns/CampaignBuilder";

const CampaignsNew = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get copied config from navigation state
  const copiedConfig = location.state?.copiedConfig as Partial<CampaignConfig> | undefined;
  const sourceCampaignName = location.state?.sourceCampaignName as string | undefined;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-gradient-primary shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/campaigns")}
              className="text-primary-foreground hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Powrót do kampanii
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-primary-foreground flex items-center gap-2">
                <Sparkles className="h-8 w-8" />
                {copiedConfig ? "Kopiowanie kampanii" : "Nowa Kampania AI"}
              </h1>
              <p className="text-sm text-primary-foreground/90 mt-1">
                {copiedConfig 
                  ? `Na podstawie: ${sourceCampaignName}` 
                  : "Stwórz profesjonalną kampanię z zasadą 80/20 (80% content, 20% sprzedaż)"}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {copiedConfig && (
          <Alert className="mb-6 bg-primary/5 border-primary/20">
            <Copy className="h-4 w-4" />
            <AlertDescription>
              Kampania została skopiowana. Możesz zmodyfikować wszystkie parametry przed uruchomieniem.
            </AlertDescription>
          </Alert>
        )}
        <Card className="p-8 bg-gradient-card border-border/50 shadow-card">
          <CampaignBuilder initialConfig={copiedConfig} />
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default CampaignsNew;
