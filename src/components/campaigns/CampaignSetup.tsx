import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Calendar, Clock, ArrowRight, Plus, X, ArrowUpDown, AlertCircle, Sparkles, RefreshCw, Percent } from "lucide-react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignConfig } from "./CampaignBuilder";
import { PlatformSelector } from "./PlatformSelector";
import { BookSelector } from "./BookSelector";
import { useSearchParams } from "react-router-dom";
import { PlatformId, getAllPlatforms } from "@/config/platforms";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CampaignSetupProps {
  onComplete: (config: CampaignConfig) => void;
}

export const CampaignSetup = ({ onComplete }: CampaignSetupProps) => {
  const [searchParams] = useSearchParams();
  const preSelectedPlatform = searchParams.get('platform') as PlatformId | null;
  
  const [campaignName, setCampaignName] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [postsPerDay, setPostsPerDay] = useState(2);
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [postingTimes, setPostingTimes] = useState(["10:00", "18:00"]);
  const [targetPlatforms, setTargetPlatforms] = useState<PlatformId[]>(
    preSelectedPlatform ? [preSelectedPlatform] : ['x']
  );
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [useAI, setUseAI] = useState(true);
  const [regenerateTexts, setRegenerateTexts] = useState(false);
  const [contentRatio, setContentRatio] = useState(20); // Default 20% content, 80% sales
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

    // Check TikTok connection
    const { data: tiktokData } = await (supabase as any)
      .from('tiktok_oauth_tokens')
      .select('id')
      .limit(1)
      .maybeSingle();

    // Set connection status for all platforms
    platforms.forEach(platform => {
      if (platform.id === 'x') {
        connectionStatus[platform.id] = !!xData;
      } else if (platform.id === 'facebook') {
        connectionStatus[platform.id] = !!fbData;
      } else if (platform.id === 'tiktok') {
        connectionStatus[platform.id] = !!tiktokData;
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

  const addPostingTime = () => {
    const lastTime = postingTimes[postingTimes.length - 1];
    const [hours, minutes] = lastTime.split(':').map(Number);
    const newHour = (hours + 2) % 24;
    const newTime = `${newHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    setPostingTimes([...postingTimes, newTime]);
    setPostsPerDay(postingTimes.length + 1);
  };

  const removePostingTime = (index: number) => {
    if (postingTimes.length > 1) {
      const newTimes = postingTimes.filter((_, i) => i !== index);
      setPostingTimes(newTimes);
      setPostsPerDay(newTimes.length);
    }
  };

  const sortPostingTimes = () => {
    const sorted = [...postingTimes].sort((a, b) => {
      const [aHours, aMinutes] = a.split(':').map(Number);
      const [bHours, bMinutes] = b.split(':').map(Number);
      return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
    });
    setPostingTimes(sorted);
  };

  const totalPosts = durationDays * postsPerDay;
  const contentPosts = Math.floor(totalPosts * (contentRatio / 100));
  const salesPosts = totalPosts - contentPosts;

  const handleSubmit = () => {
    // Sort posting times before submitting
    const sortedTimes = [...postingTimes].sort((a, b) => {
      const [aHours, aMinutes] = a.split(':').map(Number);
      const [bHours, bMinutes] = b.split(':').map(Number);
      return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
    });
    
    // Generate default name if empty
    const finalName = campaignName.trim() || `Kampania ${format(new Date(startDate), 'dd.MM.yyyy')}`;
    
    onComplete({
      name: finalName,
      durationDays,
      postsPerDay,
      startDate,
      startTime: sortedTimes[0],
      postingTimes: sortedTimes,
      targetPlatforms,
      selectedBooks,
      useAI,
      regenerateTexts,
      contentRatio
    });
  };

  const canSubmit = selectedBooks.length > 0;

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-secondary/30">
        <h3 className="text-lg font-semibold mb-4">Parametry kampanii</h3>
        
        {/* Campaign Name */}
        <div className="space-y-2 mb-6">
          <Label htmlFor="campaignName" className="flex items-center gap-2">
            Nazwa kampanii
          </Label>
          <Input
            id="campaignName"
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder={`Kampania ${format(new Date(startDate), 'dd.MM.yyyy')}`}
            className="max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            Jeśli pozostawisz puste, nazwa zostanie wygenerowana automatycznie
          </p>
        </div>
        
        {/* Use AI Checkbox */}
        <div className="flex items-center space-x-3 mb-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <Checkbox
            id="useAI"
            checked={useAI}
            onCheckedChange={(checked) => setUseAI(checked === true)}
          />
          <div className="flex-1">
            <Label htmlFor="useAI" className="flex items-center gap-2 cursor-pointer">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium">Użyj AI do generowania treści</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {useAI 
                ? "Grok AI wygeneruje unikalne, angażujące treści dla każdego posta" 
                : "Posty zostaną utworzone z opisów książek z bazy danych"}
            </p>
          </div>
        </div>
        
        {/* Regenerate Texts Checkbox */}
        <div className="flex items-center space-x-3 mb-6 p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
          <Checkbox
            id="regenerateTexts"
            checked={regenerateTexts}
            onCheckedChange={(checked) => setRegenerateTexts(checked === true)}
          />
          <div className="flex-1">
            <Label htmlFor="regenerateTexts" className="flex items-center gap-2 cursor-pointer">
              <RefreshCw className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Generuj nowe teksty</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {regenerateTexts 
                ? "Nowe teksty zostaną wygenerowane dla wszystkich książek" 
                : "Użyj tekstów z poprzednich kampanii (jeśli istnieją)"}
            </p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Duration */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Czas trwania kampanii (dni)
            </Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[durationDays]}
                onValueChange={(value) => setDurationDays(value[0])}
                min={1}
                max={90}
                step={1}
                className="flex-1 max-w-md"
              />
              <Input
                type="number"
                min={1}
                max={90}
                value={durationDays}
                onChange={(e) => setDurationDays(Math.min(90, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">dni</span>
            </div>
          </div>

          {/* Posts per day */}
          <div className="space-y-3">
            <Label>Liczba postów dziennie</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[postsPerDay]}
                onValueChange={(value) => handlePostsPerDayChange(value[0])}
                min={1}
                max={20}
                step={1}
                className="flex-1 max-w-md"
              />
              <Input
                type="number"
                min={1}
                max={20}
                value={postsPerDay}
                onChange={(e) => handlePostsPerDayChange(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">postów</span>
            </div>
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

          {/* Content/Sales Ratio Slider */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Proporcja postów contentowych vs sprzedażowych
            </Label>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-24">Content: {contentRatio}%</span>
              <Slider
                value={[contentRatio]}
                onValueChange={(value) => setContentRatio(value[0])}
                min={0}
                max={100}
                step={5}
                className="flex-1 max-w-md"
              />
              <span className="text-sm text-muted-foreground w-28">Sprzedaż: {100 - contentRatio}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {contentRatio === 0 && "Tylko posty sprzedażowe - bezpośrednia promocja książek"}
              {contentRatio > 0 && contentRatio < 30 && "Większość postów sprzedażowych z odrobiną contentu"}
              {contentRatio >= 30 && contentRatio <= 50 && "Zrównoważona mieszanka contentu i sprzedaży"}
              {contentRatio > 50 && contentRatio < 100 && "Większość postów contentowych, mniej promocji"}
              {contentRatio === 100 && "Tylko posty contentowe - ciekawostki, zagadki, wydarzenia"}
            </p>
          </div>

          {/* Posting times */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Godziny publikacji
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={sortPostingTimes}
                  className="gap-1"
                >
                  <ArrowUpDown className="h-3 w-3" />
                  Sortuj
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPostingTime}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Dodaj
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {postingTimes.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background min-w-[100px]">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{time}</span>
                  </div>
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => handleTimeChange(index, e.target.value)}
                    className="max-w-[150px]"
                  />
                  {postingTimes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePostingTime(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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

      {/* Book Selection */}
      <BookSelector
        selectedBooks={selectedBooks}
        onSelectionChange={setSelectedBooks}
      />

      {!canSubmit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Musisz wybrać co najmniej jedną książkę do kampanii
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <Card className="p-6 bg-gradient-subtle border-primary/20">
        <h3 className="text-lg font-semibold mb-4">Podsumowanie kampanii</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Łącznie postów</p>
            <p className="text-3xl font-bold text-primary">{totalPosts}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Posty contentowe ({contentRatio}%)</p>
            <p className="text-3xl font-bold text-blue-500">{contentPosts}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Posty sprzedażowe ({100 - contentRatio}%)</p>
            <p className="text-3xl font-bold text-green-500">{salesPosts}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Wybrane książki</p>
            <p className="text-3xl font-bold text-amber-500">{selectedBooks.length}</p>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Strategia {contentRatio}/{100 - contentRatio}:</strong>
          </p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• {contentRatio}% postów to wartościowy content (ciekawostki, zagadki, wydarzenia)</li>
            <li>• {100 - contentRatio}% postów to bezpośrednia promocja i sprzedaż książek</li>
            <li>• {useAI ? "Grok AI automatycznie dobierze odpowiednie typy postów" : "Treści zostaną pobrane z opisów książek w bazie"}</li>
          </ul>
        </div>
      </Card>

      <Button onClick={handleSubmit} className="w-full" size="lg" disabled={!canSubmit}>
        Przejdź do generowania planu
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};