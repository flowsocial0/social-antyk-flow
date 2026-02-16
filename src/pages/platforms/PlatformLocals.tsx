import { useState } from "react";
import { Map } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformLocals = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="locals"
          platformName="Locals"
          icon={
            <div className="p-3 bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 rounded-lg">
              <Map className="h-8 w-8 text-emerald-600" />
            </div>
          }
          description="Zarządzaj publikacjami na Locals"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="locals" />
          <PlatformStats platform="locals" />
        </div>

        <PlatformAnalytics platform="locals" />

        <PlatformBooksList
          platform="locals"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformLocals;
