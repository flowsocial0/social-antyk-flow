import { useState } from "react";
import { Camera } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformBeReal = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="bereal"
          platformName="BeReal"
          icon={
            <div className="p-3 bg-gradient-to-br from-slate-900/20 to-yellow-500/20 rounded-lg">
              <Camera className="h-8 w-8 text-slate-900" />
            </div>
          }
          description="Zarządzaj publikacjami na BeReal"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="bereal" />
          <PlatformStats platform="bereal" />
        </div>

        <PlatformAnalytics platform="bereal" />

        <PlatformBooksList
          platform="bereal"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformBeReal;
