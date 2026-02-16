import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformThreads = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="threads"
          platformName="Threads"
          icon={
            <div className="p-3 bg-gradient-to-br from-slate-800/20 to-slate-900/20 rounded-lg">
              <MessageCircle className="h-8 w-8 text-slate-800" />
            </div>
          }
          description="Zarządzaj publikacjami na Threads"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="threads" />
          <PlatformStats platform="threads" />
        </div>

        <PlatformAnalytics platform="threads" />

        <PlatformBooksList
          platform="threads"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformThreads;
