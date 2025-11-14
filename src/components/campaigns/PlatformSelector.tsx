import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Twitter, Facebook, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PlatformSelectorProps {
  selected: ('x' | 'facebook')[];
  onChange: (platforms: ('x' | 'facebook')[]) => void;
  connectedPlatforms: {
    x: boolean;
    facebook: boolean;
  };
}

export const PlatformSelector = ({ selected, onChange, connectedPlatforms }: PlatformSelectorProps) => {
  const handleToggle = (platform: 'x' | 'facebook') => {
    if (selected.includes(platform)) {
      // Don't allow deselecting if it's the last platform
      if (selected.length === 1) return;
      onChange(selected.filter(p => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  const isDisabled = (platform: 'x' | 'facebook') => {
    return !connectedPlatforms[platform];
  };

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h4 className="font-medium mb-2">Platformy publikacji</h4>
        <p className="text-sm text-muted-foreground">
          Wybierz platformy, na których mają zostać opublikowane posty
        </p>
      </div>

      <div className="space-y-3">
        {/* X/Twitter */}
        <div className="flex items-center space-x-3">
          <Checkbox
            id="platform-x"
            checked={selected.includes('x')}
            onCheckedChange={() => handleToggle('x')}
            disabled={isDisabled('x')}
          />
          <Label
            htmlFor="platform-x"
            className={`flex items-center gap-2 cursor-pointer ${isDisabled('x') ? 'opacity-50' : ''}`}
          >
            <Twitter className="h-4 w-4 text-blue-500" />
            <span>X (Twitter)</span>
            {connectedPlatforms.x && (
              <span className="text-xs text-green-600">✓ Połączono</span>
            )}
          </Label>
        </div>

        {/* Facebook */}
        <div className="flex items-center space-x-3">
          <Checkbox
            id="platform-facebook"
            checked={selected.includes('facebook')}
            onCheckedChange={() => handleToggle('facebook')}
            disabled={isDisabled('facebook')}
          />
          <Label
            htmlFor="platform-facebook"
            className={`flex items-center gap-2 cursor-pointer ${isDisabled('facebook') ? 'opacity-50' : ''}`}
          >
            <Facebook className="h-4 w-4 text-blue-600" />
            <span>Facebook</span>
            {connectedPlatforms.facebook && (
              <span className="text-xs text-green-600">✓ Połączono</span>
            )}
          </Label>
        </div>
      </div>

      {/* Warning if platform not connected */}
      {(selected.includes('x') && !connectedPlatforms.x) || (selected.includes('facebook') && !connectedPlatforms.facebook) ? (
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
      ) : null}

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
