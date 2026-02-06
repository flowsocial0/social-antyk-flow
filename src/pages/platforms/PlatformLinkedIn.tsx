import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Linkedin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformLinkedIn = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const error = searchParams.get('error');
    const cancelled = searchParams.get('cancelled');
    
    if (error || cancelled) {
      toast({
        title: "Błąd połączenia z LinkedIn",
        description: error || "Autoryzacja została anulowana",
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="linkedin"
          platformName="LinkedIn"
          icon={
            <div className="p-3 bg-gradient-to-br from-blue-700/20 to-blue-800/20 rounded-lg">
              <Linkedin className="h-8 w-8 text-blue-700" />
            </div>
          }
          description="Zarządzaj publikacjami na LinkedIn"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="linkedin" />
          <PlatformStats platform="linkedin" />
        </div>

        <PlatformAnalytics platform="linkedin" />

        <PlatformBooksList
          platform="linkedin"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformLinkedIn;
