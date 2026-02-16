import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Type, Image, Video } from "lucide-react";
import { platformConfigs, type PlatformId, type MediaType } from "@/config/platforms";

interface PlatformHeaderProps {
  platformId: string;
  platformName: string;
  icon: React.ReactNode;
  description?: string;
}

const getMediaInfo = (mediaType: MediaType) => {
  switch (mediaType) {
    case 'video-only':
      return { icons: [Video], label: 'Tylko wideo' };
    case 'image-only':
      return { icons: [Type, Image], label: 'Tekst + Obrazki' };
    case 'both':
      return { icons: [Type, Image, Video], label: 'Tekst + Obrazki + Wideo' };
  }
};

export function PlatformHeader({ platformId, platformName, icon, description }: PlatformHeaderProps) {
  const navigate = useNavigate();
  const config = platformConfigs[platformId as PlatformId];
  const media = config ? getMediaInfo(config.mediaType) : null;

  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/platforms')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">{platformName}</h1>
              {media && (
                <Badge variant="outline" className="gap-1.5 text-xs font-normal">
                  {media.icons.map((MIcon, i) => (
                    <MIcon key={i} className="h-3.5 w-3.5" />
                  ))}
                  {media.label}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {description || `Zarządzaj publikacjami na ${platformName}`}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => navigate(`/campaigns/new?platform=${platformId}`)} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Stwórz kampanię
        </Button>
        <Button variant="outline" onClick={() => navigate('/platforms')}>
          Powrót
        </Button>
      </div>
    </div>
  );
}
