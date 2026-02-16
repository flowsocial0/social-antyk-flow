import { useState } from "react";
import { Image } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformPinterest = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="pinterest"
          platformName="Pinterest"
          icon={
            <div className="p-3 bg-gradient-to-br from-red-600/20 to-red-700/20 rounded-lg">
              <Image className="h-8 w-8 text-red-600" />
            </div>
          }
          description="Zarządzaj publikacjami na Pinterest"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="pinterest" />
          <PlatformStats platform="pinterest" />
        </div>

        <PlatformAnalytics platform="pinterest" />

        <PlatformBooksList
          platform="pinterest"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformPinterest;
