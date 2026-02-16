import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformDiscord = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="discord"
          platformName="Discord"
          icon={
            <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 rounded-lg">
              <MessageCircle className="h-8 w-8 text-indigo-500" />
            </div>
          }
          description="Zarządzaj publikacjami na Discord"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="discord" />
          <PlatformStats platform="discord" />
        </div>

        <PlatformAnalytics platform="discord" />

        <PlatformBooksList
          platform="discord"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformDiscord;
