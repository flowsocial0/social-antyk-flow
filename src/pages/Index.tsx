import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { BooksList } from "@/components/books/BooksList";
import { PlatformTabs } from "@/components/dashboard/PlatformTabs";
import { XPlatformContent } from "@/components/dashboard/platforms/XPlatformContent";
import { FacebookPlatformContent } from "@/components/dashboard/platforms/FacebookPlatformContent";
import { InstagramPlatformContent } from "@/components/dashboard/platforms/InstagramPlatformContent";
import { YouTubePlatformContent } from "@/components/dashboard/platforms/YouTubePlatformContent";
import { LinkedInPlatformContent } from "@/components/dashboard/platforms/LinkedInPlatformContent";
import { OtherPlatformsContent } from "@/components/dashboard/platforms/OtherPlatformsContent";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";

type Platform = 'x' | 'facebook' | 'instagram' | 'youtube' | 'linkedin' | 'other';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('x');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check auth status
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Wylogowano",
      description: "Do zobaczenia!",
    });
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Ładowanie...</p>
    </div>;
  }

  if (!user) {
    return null;
  }

  const renderPlatformContent = () => {
    switch (selectedPlatform) {
      case 'x':
        return <XPlatformContent />;
      case 'facebook':
        return <FacebookPlatformContent />;
      case 'instagram':
        return <InstagramPlatformContent />;
      case 'youtube':
        return <YouTubePlatformContent />;
      case 'linkedin':
        return <LinkedInPlatformContent />;
      case 'other':
        return <OtherPlatformsContent />;
      default:
        return <XPlatformContent />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-gradient-primary shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary-foreground">SocialFlow</h1>
              <p className="text-sm text-primary-foreground/90 mt-1">Menedżer mediów społecznościowych księgarni Antyk</p>
            </div>
            <Button variant="outline" onClick={handleLogout} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <LogOut className="mr-2 h-4 w-4" />
              Wyloguj
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Overview - Wspólne dla wszystkich platform */}
        <DashboardStats />

        {/* Quick Actions - Wspólne dla wszystkich platform */}
        <QuickActions />

        {/* Platform Switcher */}
        <PlatformTabs 
          selectedPlatform={selectedPlatform} 
          onPlatformChange={setSelectedPlatform}
        />

        {/* Platform-Specific Content */}
        {renderPlatformContent()}

        {/* Books List - Wspólne dla wszystkich platform */}
        <BooksList />

        {/* Recent Activity - Wspólne dla wszystkich platform */}
        <RecentActivity />
      </main>
    </div>
  );
};

export default Index;