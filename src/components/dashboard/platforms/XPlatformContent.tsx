import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Twitter, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const XPlatformContent = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Twitter className="h-6 w-6 text-blue-500" />
            <h3 className="text-xl font-semibold">X (Twitter)</h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/social-accounts')}>
            <Settings className="h-4 w-4 mr-2" />
            Ustawienia
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Statystyki platformy</h4>
            <p className="text-sm text-muted-foreground">
              Tutaj pojawią się statystyki specyficzne dla X/Twitter
            </p>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Zaplanowane posty</h4>
            <p className="text-sm text-muted-foreground">
              Lista zaplanowanych postów dla X/Twitter
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
