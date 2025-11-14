import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const FacebookPlatformContent = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Facebook className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-semibold">Facebook</h3>
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
              Tutaj pojawią się statystyki specyficzne dla Facebook
            </p>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Zaplanowane posty</h4>
            <p className="text-sm text-muted-foreground">
              Lista zaplanowanych postów dla Facebook
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
