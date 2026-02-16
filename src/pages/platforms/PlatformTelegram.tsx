import { useState } from "react";
import { Send } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";

const PlatformTelegram = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        <PlatformHeader
          platformId="telegram"
          platformName="Telegram"
          icon={
            <div className="p-3 bg-gradient-to-br from-sky-500/20 to-sky-600/20 rounded-lg">
              <Send className="h-8 w-8 text-sky-500" />
            </div>
          }
          description="Zarządzaj publikacjami na Telegram"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="telegram" />
          <PlatformStats platform="telegram" />
        </div>

        <PlatformAnalytics platform="telegram" />

        <PlatformBooksList
          platform="telegram"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformTelegram;
