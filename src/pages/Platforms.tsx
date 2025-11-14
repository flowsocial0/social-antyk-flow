import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { getAllPlatforms, getActivePlatforms, getComingSoonPlatforms, getPlannedPlatforms } from "@/config/platforms";

const Platforms = () => {
  const navigate = useNavigate();
  const activePlatforms = getActivePlatforms();
  const comingSoonPlatforms = getComingSoonPlatforms();
  const plannedPlatforms = getPlannedPlatforms();

  const PlatformCard = ({ platform }: { platform: any }) => {
    const Icon = platform.icon;
    const statusBadge = platform.status === 'active' 
      ? <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Aktywna</Badge>
      : platform.status === 'coming-soon'
      ? <Badge variant="outline">Wkrótce</Badge>
      : <Badge variant="secondary">Planowana</Badge>;

    return (
      <Card 
        className="p-6 hover:shadow-glow transition-all duration-300 cursor-pointer border-border/50 bg-gradient-card"
        onClick={() => navigate(platform.path)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className={`p-4 rounded-lg bg-gradient-to-br ${platform.gradientFrom} ${platform.gradientTo}`}>
            <Icon className={`h-8 w-8 ${platform.color}`} />
          </div>
          {statusBadge}
        </div>
        <h3 className="text-lg font-semibold mb-1">{platform.name}</h3>
        <p className="text-sm text-muted-foreground">
          {platform.status === 'active' 
            ? 'Zarządzaj publikacjami i harmonogramem'
            : 'Integracja w przygotowaniu'}
        </p>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Platformy społecznościowe</h1>
            <p className="text-muted-foreground">
              Wybierz platformę, aby zarządzać publikacjami i harmonogramem
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Powrót
          </Button>
        </div>

        {/* Active Platforms */}
        {activePlatforms.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Aktywne platformy</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activePlatforms.map((platform) => (
                <PlatformCard key={platform.id} platform={platform} />
              ))}
            </div>
          </div>
        )}

        {/* Coming Soon Platforms */}
        {comingSoonPlatforms.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Wkrótce dostępne</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {comingSoonPlatforms.map((platform) => (
                <PlatformCard key={platform.id} platform={platform} />
              ))}
            </div>
          </div>
        )}

        {/* Planned Platforms */}
        {plannedPlatforms.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Planowane integracje</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {plannedPlatforms.map((platform) => (
                <PlatformCard key={platform.id} platform={platform} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Platforms;
