import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Plus } from "lucide-react";
import { CampaignsList } from "@/components/campaigns/CampaignsList";
import { Footer } from "@/components/layout/Footer";
import type { User } from "@supabase/supabase-js";

const Campaigns = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/")}
                className="text-primary-foreground hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Powrót
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-primary-foreground flex items-center gap-2">
                  <Sparkles className="h-8 w-8" />
                  Kampanie AI
                </h1>
                <p className="text-sm text-primary-foreground/90 mt-1">
                  Zarządzaj swoimi kampaniami marketingowymi
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/campaigns/new")}
              className="gap-2 bg-white text-primary hover:bg-white/90"
            >
              <Plus className="h-4 w-4" />
              Nowa kampania
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <CampaignsList />
      </main>
      
      <Footer />
    </div>
  );
};

export default Campaigns;