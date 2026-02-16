import { useState } from "react";
import { DollarSign } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformOnlyFans = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="onlyfans"
          platformName="OnlyFans"
          icon={
            <div className="p-3 bg-gradient-to-br from-blue-400/20 to-blue-500/20 rounded-lg">
              <DollarSign className="h-8 w-8 text-blue-400" />
            </div>
          }
          description="Zarządzaj publikacjami na OnlyFans"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="onlyfans" />
          <PlatformStats platform="onlyfans" />
        </div>

        <PlatformAnalytics platform="onlyfans" />

        <PlatformBooksList
          platform="onlyfans"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformOnlyFans;
