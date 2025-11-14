import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const OtherPlatformsContent = () => {
  const upcomingPlatforms = [
    { name: "TikTok", status: "Planowana" },
    { name: "Pinterest", status: "Planowana" },
    { name: "Reddit", status: "Planowana" },
    { name: "Telegram", status: "Planowana" },
    { name: "Threads", status: "Planowana" },
    { name: "BeReal", status: "W rozważaniu" },
    { name: "Bluesky", status: "W rozważaniu" },
    { name: "Mastodon", status: "W rozważaniu" },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-xl font-semibold mb-4">Przyszłe integracje</h3>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pracujemy nad integracją z kolejnymi platformami społecznościowymi
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {upcomingPlatforms.map((platform) => (
              <div 
                key={platform.name}
                className="p-4 bg-muted/50 rounded-lg border border-border/50 flex items-center justify-between"
              >
                <span className="font-medium">{platform.name}</span>
                <Badge variant="outline" className="text-xs">
                  {platform.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
