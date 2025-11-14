import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Twitter, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlatformBooksList } from "@/components/platforms/PlatformBooksList";
import { PlatformConnectionStatus } from "@/components/platforms/PlatformConnectionStatus";
import { PlatformStats } from "@/components/platforms/PlatformStats";
import { PlatformAnalytics } from "@/components/platforms/PlatformAnalytics";

export default function PlatformX() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Twitter className="h-8 w-8 text-[#1DA1F2]" />
              <div>
                <h1 className="text-3xl font-bold">X (Twitter)</h1>
                <p className="text-muted-foreground">Zarządzaj publikacjami na X</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Status & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlatformConnectionStatus platform="x" />
          <PlatformStats platform="x" />
        </div>

        {/* Analytics */}
        <PlatformAnalytics platform="x" />

        {/* Books List */}
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
