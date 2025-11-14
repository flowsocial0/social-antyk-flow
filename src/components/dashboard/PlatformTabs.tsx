import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Twitter, Facebook, Instagram, Youtube, Linkedin } from "lucide-react";

type Platform = 'x' | 'facebook' | 'instagram' | 'youtube' | 'linkedin' | 'other';

interface PlatformTabsProps {
  selectedPlatform: Platform;
  onPlatformChange: (platform: Platform) => void;
}

export const PlatformTabs = ({ selectedPlatform, onPlatformChange }: PlatformTabsProps) => {
  const platforms = [
    { id: 'x' as Platform, label: 'X (Twitter)', icon: Twitter },
    { id: 'facebook' as Platform, label: 'Facebook', icon: Facebook },
    { id: 'instagram' as Platform, label: 'Instagram', icon: Instagram },
    { id: 'youtube' as Platform, label: 'YouTube', icon: Youtube },
    { id: 'linkedin' as Platform, label: 'LinkedIn', icon: Linkedin },
    { id: 'other' as Platform, label: 'Inne platformy', icon: null },
  ];

  return (
    <Tabs value={selectedPlatform} onValueChange={(value) => onPlatformChange(value as Platform)} className="w-full">
      <TabsList className="grid w-full grid-cols-6 h-auto bg-muted/50">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          return (
            <TabsTrigger
              key={platform.id}
              value={platform.id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-3"
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span className="hidden sm:inline">{platform.label}</span>
              <span className="sm:hidden">{platform.id.toUpperCase()}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
};
