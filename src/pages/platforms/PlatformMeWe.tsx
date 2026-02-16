import { useState } from "react";
import { Users } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformMeWe = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="mewe"
          platformName="MeWe"
          icon={
            <div className="p-3 bg-gradient-to-br from-indigo-600/20 to-indigo-700/20 rounded-lg">
              <Users className="h-8 w-8 text-indigo-600" />
            </div>
          }
          description="Zarządzaj publikacjami na MeWe"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="mewe" />
          <PlatformStats platform="mewe" />
        </div>

        <PlatformAnalytics platform="mewe" />

        <PlatformBooksList
          platform="mewe"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformMeWe;
