import { useState } from "react";
import { Shield } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformParler = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="parler"
          platformName="Parler"
          icon={
            <div className="p-3 bg-gradient-to-br from-rose-600/20 to-rose-700/20 rounded-lg">
              <Shield className="h-8 w-8 text-rose-600" />
            </div>
          }
          description="Zarządzaj publikacjami na Parler"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="parler" />
          <PlatformStats platform="parler" />
        </div>

        <PlatformAnalytics platform="parler" />

        <PlatformBooksList
          platform="parler"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformParler;
