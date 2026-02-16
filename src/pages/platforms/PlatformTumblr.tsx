import { useState } from "react";
import { Globe } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformTumblr = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="tumblr"
          platformName="Tumblr"
          icon={
            <div className="p-3 bg-gradient-to-br from-blue-900/20 to-blue-950/20 rounded-lg">
              <Globe className="h-8 w-8 text-blue-900" />
            </div>
          }
          description="Zarządzaj publikacjami na Tumblr"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="tumblr" />
          <PlatformStats platform="tumblr" />
        </div>

        <PlatformAnalytics platform="tumblr" />

        <PlatformBooksList
          platform="tumblr"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformTumblr;
