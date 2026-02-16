import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformReddit = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="reddit"
          platformName="Reddit"
          icon={
            <div className="p-3 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-lg">
              <MessageCircle className="h-8 w-8 text-orange-500" />
            </div>
          }
          description="Zarządzaj publikacjami na Reddit"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="reddit" />
          <PlatformStats platform="reddit" />
        </div>

        <PlatformAnalytics platform="reddit" />

        <PlatformBooksList
          platform="reddit"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformReddit;
