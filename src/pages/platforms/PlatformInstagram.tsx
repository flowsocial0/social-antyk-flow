import { useState } from "react";
import { Instagram, AlertTriangle } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";

const PlatformInstagram = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <main className="flex-1 container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="instagram"
          platformName="Instagram"
          icon={
            <div className="p-3 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg">
              <Instagram className="h-8 w-8 text-pink-500" />
            </div>
          }
          description="Zarządzaj publikacjami na Instagram"
        />

        <Card className="p-4 border-amber-500/50 bg-amber-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-medium text-amber-700 dark:text-amber-400">
                Wymagania Instagram API - checklista przed połączeniem
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">1.</span>
                  <span>Konto Instagram musi być typu <strong>Business</strong> lub <strong>Creator</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">2.</span>
                  <span>Musisz być <strong>administratorem strony Facebook</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">3.</span>
                  <span>W Meta Business Suite → <strong>Connect Instagram</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">4.</span>
                  <span>Podczas autoryzacji <strong>zaznacz wszystkie zgody</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">5.</span>
                  <span>Posty muszą zawierać <strong>obraz</strong> - posty tylko tekstowe nie są obsługiwane</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="instagram" />
          <PlatformStats platform="instagram" />
        </div>

        <PlatformAnalytics platform="instagram" />

        <PlatformBooksList
          platform="instagram"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </main>
      
      <Footer />
    </div>
  );
};

export default PlatformInstagram;
