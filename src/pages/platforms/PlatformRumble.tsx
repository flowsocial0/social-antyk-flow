import { useState } from "react";
import { Tv } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformRumble = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="rumble"
          platformName="Rumble"
          icon={
            <div className="p-3 bg-gradient-to-br from-green-600/20 to-green-700/20 rounded-lg">
              <Tv className="h-8 w-8 text-green-600" />
            </div>
          }
          description="Zarządzaj publikacjami na Rumble"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="rumble" />
          <PlatformStats platform="rumble" />
        </div>

        <PlatformAnalytics platform="rumble" />

        <PlatformBooksList
          platform="rumble"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformRumble;
