import { useState } from "react";
import { Youtube } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformYouTube = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="youtube"
          platformName="YouTube"
          icon={
            <div className="p-3 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-lg">
              <Youtube className="h-8 w-8 text-red-500" />
            </div>
          }
          description="Zarządzaj publikacjami na YouTube"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="youtube" />
          <PlatformStats platform="youtube" />
        </div>

        <PlatformAnalytics platform="youtube" />

        <PlatformBooksList
          platform="youtube"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformYouTube;
