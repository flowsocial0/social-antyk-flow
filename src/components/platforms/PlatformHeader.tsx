import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";

interface PlatformHeaderProps {
  platformId: string;
  platformName: string;
  icon: React.ReactNode;
  description?: string;
}

export function PlatformHeader({ platformId, platformName, icon, description }: PlatformHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/platforms')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h1 className="text-3xl font-bold">{platformName}</h1>
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
