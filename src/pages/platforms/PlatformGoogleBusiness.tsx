import { useState } from "react";
import { Map } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformGoogleBusiness = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="google_business"
          platformName="Google Business"
          icon={
            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-green-500/20 rounded-lg">
              <Map className="h-8 w-8 text-blue-500" />
            </div>
          }
          description="Zarządzaj publikacjami w Google Business"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="google_business" />
          <PlatformStats platform="google_business" />
        </div>

        <PlatformAnalytics platform="google_business" />

        <PlatformBooksList
          platform="google_business"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformGoogleBusiness;
