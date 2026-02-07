import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const OtherPlatformsContent = () => {
  const upcomingPlatforms = [
    { name: "BeReal", status: "W rozważaniu" },
    { name: "Locals", status: "W rozważaniu" },
    { name: "Rumble", status: "W rozważaniu" },
    { name: "Parler", status: "W rozważaniu" },
    { name: "MeWe", status: "W rozważaniu" },
    { name: "OnlyFans", status: "W rozważaniu" },
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
