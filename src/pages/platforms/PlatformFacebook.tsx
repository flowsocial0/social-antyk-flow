import { useState, useEffect } from "react";
import { Facebook } from "lucide-react";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";
import { useToast } from "@/hooks/use-toast";

const PlatformFacebook = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const cancelled = params.get('cancelled');
    const error = params.get('error');
    const pageName = params.get('page_name');

    if (connected === 'true') {
      toast({
        title: "✅ Połączono z Facebook",
        description: pageName ? `Połączono jako strona: ${pageName}` : "Konto Facebook zostało pomyślnie połączone",
      });
      window.history.replaceState({}, '', '/platforms/facebook');
    } else if (cancelled === 'true') {
      toast({
        title: "Anulowano połączenie z Facebook",
        description: error || "Autoryzacja została anulowana przez użytkownika",
      });
      window.history.replaceState({}, '', '/platforms/facebook');
    } else if (error) {
      toast({
        title: "❌ Błąd połączenia Facebook",
        description: error,
        variant: "destructive"
      });
      window.history.replaceState({}, '', '/platforms/facebook');
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="facebook"
          platformName="Facebook"
          icon={<Facebook className="h-8 w-8 text-[#1877F2]" />}
          description="Zarządzaj publikacjami na Facebooku"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="facebook" />
          <PlatformStats platform="facebook" />
        </div>

        <PlatformAnalytics platform="facebook" />

        <PlatformBooksList 
          platform="facebook"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformFacebook;
