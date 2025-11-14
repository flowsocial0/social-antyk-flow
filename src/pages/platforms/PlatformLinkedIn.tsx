import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Linkedin } from "lucide-react";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";

const PlatformLinkedIn = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-700/20 to-blue-800/20 rounded-lg">
              <Linkedin className="h-8 w-8 text-blue-700" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-blue-800 bg-clip-text text-transparent">
                LinkedIn
              </h1>
              <p className="text-muted-foreground">
                Zarządzaj publikacjami na LinkedIn
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              Powrót
            </Button>
          </div>
        </div>

        {/* Connection Status & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="linkedin" />
          <PlatformStats platform="linkedin" />
        </div>

        {/* Analytics */}
        <PlatformAnalytics platform="linkedin" />

        {/* Books List */}
        <PlatformBooksList
          platform="linkedin"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};

export default PlatformLinkedIn;
