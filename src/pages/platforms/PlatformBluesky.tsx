import { useState } from "react";
import { Globe } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformBluesky = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="bluesky"
          platformName="Bluesky"
          icon={
            <div className="p-3 bg-gradient-to-br from-sky-600/20 to-sky-700/20 rounded-lg">
              <Globe className="h-8 w-8 text-sky-600" />
            </div>
          }
          description="Zarządzaj publikacjami na Bluesky"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="bluesky" />
          <PlatformStats platform="bluesky" />
        </div>

        <PlatformAnalytics platform="bluesky" />

        <PlatformBooksList
          platform="bluesky"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformBluesky;
