import { useState } from "react";
import { Twitter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { XRateLimitStatus } from "@/components/platforms/XRateLimitStatus";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

export default function PlatformX() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="x"
          platformName="X (Twitter)"
          icon={<Twitter className="h-8 w-8 text-[#1DA1F2]" />}
          description="Zarządzaj publikacjami na X"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PlatformConnectionStatus platform="x" />
          <PlatformStats platform="x" />
          <XRateLimitStatus />
        </div>

        <PlatformAnalytics platform="x" />

        <Card className="p-6">
          <PlatformBooksList 
            platform="x"
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </Card>
      </div>
    </div>
  );
}
