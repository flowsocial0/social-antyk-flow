import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Instagram } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const PlatformInstagram = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <main className="flex-1 container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg">
              <Instagram className="h-8 w-8 text-pink-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                Instagram
              </h1>
              <p className="text-muted-foreground">
                Zarządzaj publikacjami na Instagram
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              Powrót
            </Button>
          </div>
        </div>

        {/* Requirements Notice */}
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
                  <span>Konto Instagram musi być typu <strong>Business</strong> lub <strong>Creator</strong> (Ustawienia → Typ konta → Przełącz na profesjonalne)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">2.</span>
                  <span>Musisz być <strong>administratorem strony Facebook</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">3.</span>
                  <span>W Meta Business Suite → <strong>Connect Instagram</strong> (pod głównym banerem) - można utworzyć połączenie z kontem Instagram bezpośrednio z Meta Business Suite</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">4.</span>
                  <span>Podczas autoryzacji <strong>zaznacz wszystkie zgody</strong> (Zarządzaj stronami, Instagram)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">5.</span>
                  <span>Posty muszą zawierać <strong>obraz</strong> - posty tylko tekstowe nie są obsługiwane. Obrazy muszą być publicznie dostępne.</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Connection Status & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="instagram" />
          <PlatformStats platform="instagram" />
        </div>

        {/* Analytics */}
        <PlatformAnalytics platform="instagram" />

        {/* Books List */}
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
