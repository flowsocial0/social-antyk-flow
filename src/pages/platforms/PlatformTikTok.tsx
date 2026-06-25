import { useState } from "react";
import { Video, ExternalLink, Music, ShieldCheck } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformHeader } from "@/components/platforms/PlatformHeader";
import { Card } from "@/components/ui/card";

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

        <Card className="p-5 border-pink-500/30 bg-pink-500/5">
          <h3 className="text-base font-semibold flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-pink-500" />
            Wymagania publikacji TikTok
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Przed każdą publikacją na TikToku w panelu kampanii widoczne są: nazwa konta, wybór
            prywatności (Publiczne / Znajomi / Tylko ja), ujawnienie treści (marka własna / treść
            markowa) oraz linki do polityk TikToka, zgodnie z wymogami Content Posting API.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
            >
              <Music className="h-4 w-4" />
              Music Usage Confirmation
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://www.tiktok.com/legal/page/global/bc-policy/en"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
            >
              Branded Content Policy
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </Card>

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

