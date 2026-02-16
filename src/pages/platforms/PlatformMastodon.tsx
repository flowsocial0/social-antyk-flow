import { useState } from "react";
import { Globe } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformMastodon = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="mastodon"
          platformName="Mastodon"
          icon={
            <div className="p-3 bg-gradient-to-br from-purple-600/20 to-purple-700/20 rounded-lg">
              <Globe className="h-8 w-8 text-purple-600" />
            </div>
          }
          description="Zarządzaj publikacjami na Mastodon"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="mastodon" />
          <PlatformStats platform="mastodon" />
        </div>

        <PlatformAnalytics platform="mastodon" />

        <PlatformBooksList
          platform="mastodon"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformMastodon;
