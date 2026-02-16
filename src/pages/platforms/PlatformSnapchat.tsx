import { useState } from "react";
import { Camera } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformSnapchat = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="snapchat"
          platformName="Snapchat"
          icon={
            <div className="p-3 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-lg">
              <Camera className="h-8 w-8 text-yellow-500" />
            </div>
          }
          description="Zarządzaj publikacjami na Snapchat"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="snapchat" />
          <PlatformStats platform="snapchat" />
        </div>

        <PlatformAnalytics platform="snapchat" />

        <PlatformBooksList
          platform="snapchat"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformSnapchat;
