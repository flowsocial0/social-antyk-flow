import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAllPlatforms, PlatformId } from "@/config/platforms";
import { Badge } from "@/components/ui/badge";

interface PlatformSelectorProps {
  selected: PlatformId[];
  onChange: (platforms: PlatformId[]) => void;
  connectedPlatforms: Record<PlatformId, boolean>;
}

export const PlatformSelector = ({ selected, onChange, connectedPlatforms }: PlatformSelectorProps) => {
  const platforms = getAllPlatforms();
  
  const handleToggle = (platform: PlatformId) => {
    if (selected.includes(platform)) {
      // Don't allow deselecting if it's the last platform
      if (selected.length === 1) return;
      onChange(selected.filter(p => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  const isDisabled = (platform: PlatformId) => {
    return !connectedPlatforms[platform];
  };

  const getStatusBadge = (platformId: PlatformId) => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return null;
    
    if (connectedPlatforms[platformId]) {
      return <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">Połączono</Badge>;
    }
    
    if (platform.status === 'active') {
      return <Badge variant="outline" className="text-xs">Wymaga połączenia</Badge>;
    }
    
    return <Badge variant="secondary" className="text-xs">
      {platform.status === 'coming-soon' ? 'Wkrótce' : 'Planowana'}
    </Badge>;
  };

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h4 className="font-medium mb-2">Platformy publikacji</h4>
        <p className="text-sm text-muted-foreground">
          Wybierz platformy, na których mają zostać opublikowane posty
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          const canUse = platform.status === 'active' || connectedPlatforms[platform.id];
          
          return (
            <div key={platform.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50">
              <Checkbox
                id={`platform-${platform.id}`}
                checked={selected.includes(platform.id)}
                onCheckedChange={() => handleToggle(platform.id)}
                disabled={!canUse}
              />
              <Label
                htmlFor={`platform-${platform.id}`}
                className={`flex items-center gap-2 cursor-pointer flex-1 ${!canUse ? 'opacity-50' : ''}`}
              >
                <div className={`p-1.5 rounded bg-gradient-to-br ${platform.gradientFrom} ${platform.gradientTo}`}>
                  <Icon className={`h-3.5 w-3.5 ${platform.color}`} />
                </div>
                <span className="text-sm">{platform.name}</span>
                <div className="ml-auto">
                  {getStatusBadge(platform.id)}
                </div>
              </Label>
            </div>
          );
        })}
      </div>

      {/* Warning if platform not connected */}
      {selected.some(p => !connectedPlatforms[p]) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Aby publikować na wybranych platformach, najpierw połącz konta w{' '}
            <a href="/settings/social-accounts" className="underline font-medium">
              ustawieniach kont społecznościowych
            </a>
            .
          </AlertDescription>
        </Alert>
      )}

      {selected.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Musisz wybrać co najmniej jedną platformę
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
};
