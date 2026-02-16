import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformGab = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="gab"
          platformName="Gab"
          icon={
            <div className="p-3 bg-gradient-to-br from-green-700/20 to-green-800/20 rounded-lg">
              <MessageCircle className="h-8 w-8 text-green-700" />
            </div>
          }
          description="Zarządzaj publikacjami na Gab"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="gab" />
          <PlatformStats platform="gab" />
        </div>

        <PlatformAnalytics platform="gab" />

        <PlatformBooksList
          platform="gab"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformGab;
