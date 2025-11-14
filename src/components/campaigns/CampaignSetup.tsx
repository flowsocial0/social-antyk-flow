import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignConfig } from "./CampaignBuilder";
import { PlatformSelector } from "./PlatformSelector";
import { useSearchParams } from "react-router-dom";
import { PlatformId, getAllPlatforms } from "@/config/platforms";

interface CampaignSetupProps {
  onComplete: (config: CampaignConfig) => void;
}

export const CampaignSetup = ({ onComplete }: CampaignSetupProps) => {
  const [searchParams] = useSearchParams();
  const preSelectedPlatform = searchParams.get('platform') as PlatformId | null;
  
  const [durationDays, setDurationDays] = useState(7);
  const [postsPerDay, setPostsPerDay] = useState(2);
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [postingTimes, setPostingTimes] = useState(["10:00", "18:00"]);
  const [targetPlatforms, setTargetPlatforms] = useState<PlatformId[]>(
    preSelectedPlatform ? [preSelectedPlatform] : ['x']
  );
  const [connectedPlatforms, setConnectedPlatforms] = useState<Record<PlatformId, boolean>>(
    {} as Record<PlatformId, boolean>
  );

  useEffect(() => {
    checkConnectedPlatforms();
  }, []);

  const checkConnectedPlatforms = async () => {
    const platforms = getAllPlatforms();
    const connectionStatus: Record<string, boolean> = {};
    
    // Check X connection
    const { data: xData } = await (supabase as any)
      .from('twitter_oauth_tokens')
      .select('id')
      .limit(1)
      .maybeSingle();

    // Check Facebook connection
    const { data: fbData } = await (supabase as any)
      .from('facebook_oauth_tokens')
      .select('id')
      .limit(1)
      .maybeSingle();

    // Set connection status for all platforms
    platforms.forEach(platform => {
      if (platform.id === 'x') {
        connectionStatus[platform.id] = !!xData;
      } else if (platform.id === 'facebook') {
        connectionStatus[platform.id] = !!fbData;
      } else {
        // For other platforms, mark as not connected
        connectionStatus[platform.id] = false;
      }
    });

    setConnectedPlatforms(connectionStatus as Record<PlatformId, boolean>);
  };

  const handlePostsPerDayChange = (value: number) => {
    setPostsPerDay(value);
    // Adjust posting times array
    const currentTimes = [...postingTimes];
    if (value > currentTimes.length) {
      // Add more times - generate evenly spaced times throughout the day
      const defaultTimes = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
      for (let i = currentTimes.length; i < value; i++) {
        if (i < defaultTimes.length) {
          currentTimes.push(defaultTimes[i]);
        } else {
          // Generate additional times if needed
          const hour = 8 + (i * 2) % 16; // Distribute between 8:00 and 23:00
          currentTimes.push(`${hour.toString().padStart(2, '0')}:00`);
        }
      }
    } else {
      // Remove excess times
      currentTimes.splice(value);
    }
    setPostingTimes(currentTimes);
  };

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...postingTimes];
    newTimes[index] = value;
    setPostingTimes(newTimes);
  };

  const totalPosts = durationDays * postsPerDay;
  const contentPosts = Math.floor(totalPosts * 0.8);
  const salesPosts = totalPosts - contentPosts;

  const handleSubmit = () => {
    onComplete({
      durationDays,
      postsPerDay,
      startDate,
      startTime: postingTimes[0],
      postingTimes,
      targetPlatforms
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-secondary/30">
        <h3 className="text-lg font-semibold mb-4">Parametry kampanii</h3>
        
        <div className="space-y-6">
          {/* Duration */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Czas trwania kampanii (dni)
            </Label>
            <Input
              type="number"
              min={1}
              max={90}
              value={durationDays}
              onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
              className="max-w-xs"
            />
          </div>

          {/* Posts per day */}
          <div className="space-y-2">
            <Label>Liczba postów dziennie</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={postsPerDay}
              onChange={(e) => handlePostsPerDayChange(parseInt(e.target.value) || 1)}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Maksymalnie 20 postów dziennie</p>
          </div>

          {/* Start date */}
          <div className="space-y-2">
            <Label>Data rozpoczęcia</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {/* Posting times */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Godziny publikacji
            </Label>
            <div className="space-y-2">
              {postingTimes.map((time, index) => (
                <Input
                  key={index}
                  type="time"
                  value={time}
                  onChange={(e) => handleTimeChange(index, e.target.value)}
                  className="max-w-xs"
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Platform Selection */}
      <PlatformSelector
        selected={targetPlatforms}
        onChange={setTargetPlatforms}
        connectedPlatforms={connectedPlatforms}
      />

      {/* Summary */}
      <Card className="p-6 bg-gradient-subtle border-primary/20">
        <h3 className="text-lg font-semibold mb-4">Podsumowanie kampanii</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Łącznie postów</p>
            <p className="text-3xl font-bold text-primary">{totalPosts}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Posty contentowe (80%)</p>
            <p className="text-3xl font-bold text-blue-500">{contentPosts}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Posty sprzedażowe (20%)</p>
            <p className="text-3xl font-bold text-green-500">{salesPosts}</p>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Strategia 80/20:</strong>
          </p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• 80% postów to wartościowy content (ciekawostki, zagadki, wydarzenia)</li>
            <li>• 20% postów to bezpośrednia promocja i sprzedaż książek</li>
            <li>• Grok AI automatycznie dobierze odpowiednie typy postów</li>
          </ul>
        </div>
      </Card>

      <Button onClick={handleSubmit} className="w-full" size="lg">
        Przejdź do generowania planu
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};