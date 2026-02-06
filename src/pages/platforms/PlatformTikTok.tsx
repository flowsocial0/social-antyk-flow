import { useState } from "react";
import { Video } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformTikTok = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="tiktok"
          platformName="TikTok"
          icon={
            <div className="p-3 bg-gradient-to-br from-slate-900/20 to-pink-500/20 rounded-lg">
              <Video className="h-8 w-8 text-slate-900" />
            </div>
          }
          description="Zarządzaj publikacjami na TikTok"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="tiktok" />
          <PlatformStats platform="tiktok" />
        </div>

        <PlatformAnalytics platform="tiktok" />

        <PlatformBooksList
          platform="tiktok"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformTikTok;
