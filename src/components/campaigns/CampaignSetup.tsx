import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, ArrowRight, Plus, X, ArrowUpDown, AlertCircle, Sparkles, RefreshCw, Percent, Shuffle } from "lucide-react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignConfig } from "./CampaignBuilder";
import { PlatformSelector } from "./PlatformSelector";
import { BookSelector } from "./BookSelector";
import { AccountSelector } from "./AccountSelector";
import { useSearchParams } from "react-router-dom";
import { PlatformId, getAllPlatforms } from "@/config/platforms";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CampaignSetupProps {
  onComplete: (config: CampaignConfig) => void;
  initialConfig?: Partial<CampaignConfig>;
}

export const CampaignSetup = ({ onComplete, initialConfig }: CampaignSetupProps) => {
  const [searchParams] = useSearchParams();
  const preSelectedPlatform = searchParams.get('platform') as PlatformId | null;
  
  const [campaignName, setCampaignName] = useState(initialConfig?.name || "");
  const [durationDays, setDurationDays] = useState(initialConfig?.durationDays || 7);
  const [postsPerDay, setPostsPerDay] = useState(initialConfig?.postsPerDay || 2);
  const [startDate, setStartDate] = useState(
    initialConfig?.startDate || format(addDays(new Date(), 1), "yyyy-MM-dd")
  );
  const [postingTimes, setPostingTimes] = useState(
    initialConfig?.postingTimes || ["10:00", "18:00"]
  );
  const [targetPlatforms, setTargetPlatforms] = useState<PlatformId[]>(
    initialConfig?.targetPlatforms || (preSelectedPlatform ? [preSelectedPlatform] : ['x'])
  );
  const [selectedBooks, setSelectedBooks] = useState<string[]>(
    initialConfig?.selectedBooks || []
  );
  const [useAI, setUseAI] = useState(initialConfig?.useAI ?? true);
  const [regenerateTexts, setRegenerateTexts] = useState(initialConfig?.regenerateTexts ?? false);
  const [contentRatio, setContentRatio] = useState(initialConfig?.contentRatio ?? 20);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<PlatformId, string[]>>(
    initialConfig?.selectedAccounts || ({} as Record<PlatformId, string[]>)
  );
  const [connectedPlatforms, setConnectedPlatforms] = useState<Record<PlatformId, boolean>>(
    {} as Record<PlatformId, boolean>
  );
  const [useRandomContent, setUseRandomContent] = useState(initialConfig?.useRandomContent ?? false);
  const [randomContentTopic, setRandomContentTopic] = useState(initialConfig?.randomContentTopic || "");

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
    // Limit to max 10 posts per day (X/Twitter daily limit for free tier)
    const limitedValue = Math.min(value, 10);
    setPostsPerDay(limitedValue);
    
    // Generate unique odd hours for posting times
    const oddHours = [7, 9, 11, 13, 15, 17, 19, 21, 23, 5];
    const newTimes: string[] = [];
    
    for (let i = 0; i < limitedValue; i++) {
      if (i < oddHours.length) {
        newTimes.push(`${oddHours[i].toString().padStart(2, '0')}:00`);
      } else {
        // Fallback for edge cases
        const hour = (8 + i * 2) % 24;
        newTimes.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }
    
    // Sort times chronologically
    newTimes.sort((a, b) => {
      const [aH, aM] = a.split(':').map(Number);
      const [bH, bM] = b.split(':').map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
    });
    
    setPostingTimes(newTimes);
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
  
  // X.com has a 10 posts/day limit, so max 60 posts per campaign (6 days) - only when AI is used
  const X_DAILY_LIMIT = 10;
  const X_MAX_CAMPAIGN_POSTS = 60;
  const hasX = targetPlatforms.includes('x');
  const usesAI = useAI || useRandomContent;
  const exceedsXLimit = hasX && usesAI && totalPosts > X_MAX_CAMPAIGN_POSTS;

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
      contentRatio: useRandomContent ? 100 : contentRatio,
      selectedAccounts,
      useRandomContent,
      randomContentTopic: useRandomContent ? randomContentTopic : undefined,
    });
  };

  const canSubmit = (useRandomContent || selectedBooks.length > 0) && !exceedsXLimit;

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
        
        {/* Use AI Checkbox - hidden when useRandomContent is enabled */}
        {!useRandomContent && (
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
        )}
        
        {/* Regenerate Texts Checkbox */}
        <div className="flex items-center space-x-3 mb-4 p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
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
        
        {/* Random Content Generation */}
        <div className="space-y-3 mb-6 p-4 bg-purple-500/5 rounded-lg border border-purple-500/20">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="useRandomContent"
              checked={useRandomContent}
              onCheckedChange={(checked) => {
                const isEnabled = checked === true;
                setUseRandomContent(isEnabled);
                // Auto-enable AI + force 100% ciekawostki when random content is enabled
                if (isEnabled) {
                  setUseAI(true);
                  setContentRatio(100);
                } else {
                  // Back to default mix when leaving random mode
                  setContentRatio(20);
                }
              }}
            />
            <div className="flex-1">
              <Label htmlFor="useRandomContent" className="flex items-center gap-2 cursor-pointer">
                <Shuffle className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Generuj losowe treści na określony temat</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Posty ciekawostki będą generowane na podany temat zamiast na podstawie książek (AI włączone automatycznie)
              </p>
            </div>
          </div>
          
          {useRandomContent && (
            <div className="mt-3">
              <Label htmlFor="randomContentTopic" className="text-sm">Temat do generowania</Label>
              <Textarea
                id="randomContentTopic"
                value={randomContentTopic}
                onChange={(e) => setRandomContentTopic(e.target.value)}
                placeholder="np. Historia Polski XX wieku, Literatura romantyzmu, Powstanie Warszawskie..."
                className="mt-1 min-h-[80px]"
              />
            </div>
          )}
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
                max={10}
                step={1}
                className="flex-1 max-w-md"
              />
              <Input
                type="number"
                min={1}
                max={10}
                value={postsPerDay}
                onChange={(e) => handlePostsPerDayChange(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">postów</span>
            </div>
            <p className="text-xs text-muted-foreground">Maksymalnie 10 postów dziennie (limit API X)</p>
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
          {!useRandomContent ? (
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Proporcja postów ciekawostek vs sprzedażowych
              </Label>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-24">Ciekawostki: {contentRatio}%</span>
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
                {contentRatio > 0 && contentRatio < 30 && "Większość postów sprzedażowych z odrobiną ciekawostek"}
                {contentRatio >= 30 && contentRatio <= 50 && "Zrównoważona mieszanka ciekawostek i sprzedaży"}
                {contentRatio > 50 && contentRatio < 100 && "Większość postów ciekawostek, mniej promocji"}
                {contentRatio === 100 && "Tylko posty ciekawostki - zagadki, wydarzenia historyczne"}
              </p>
            </div>
          ) : (
            <Card className="p-4 bg-purple-500/5 border-purple-500/20">
              <p className="text-sm text-muted-foreground">
                <Shuffle className="h-4 w-4 inline mr-2 text-purple-500" />
                Tryb losowego tematu: wszystkie posty będą <span className="font-medium">ciekawostkami (100%)</span>.
              </p>
            </Card>
          )}

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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {postingTimes.map((time, index) => (
                <div key={index} className="flex items-center gap-1 border rounded-md px-3 py-2 bg-background">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={time.split(':')[0]}
                    onChange={(e) => {
                      const newHour = e.target.value;
                      const minutes = time.split(':')[1] || '00';
                      handleTimeChange(index, `${newHour}:${minutes}`);
                    }}
                    className="bg-transparent border-none focus:outline-none text-sm font-medium w-12"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h.toString().padStart(2, '0')}>
                        {h.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span>:</span>
                  <select
                    value={time.split(':')[1] || '00'}
                    onChange={(e) => {
                      const hours = time.split(':')[0];
                      handleTimeChange(index, `${hours}:${e.target.value}`);
                    }}
                    className="bg-transparent border-none focus:outline-none text-sm font-medium w-12"
                  >
                    {Array.from({ length: 60 }, (_, m) => {
                      const mm = m.toString().padStart(2, '0');
                      return (
                        <option key={mm} value={mm}>
                          {mm}
                        </option>
                      );
                    })}
                  </select>
                  {postingTimes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePostingTime(index)}
                      className="text-destructive hover:text-destructive h-6 w-6 p-0 ml-1"
                    >
                      <X className="h-3 w-3" />
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

      {/* Account Selection (only shows if multiple accounts per platform) */}
      <AccountSelector
        selectedPlatforms={targetPlatforms}
        selectedAccounts={selectedAccounts}
        onChange={setSelectedAccounts}
      />

      {/* Book Selection - optional when using random content */}
      {!useRandomContent && (
        <BookSelector
          selectedBooks={selectedBooks}
          onSelectionChange={setSelectedBooks}
        />
      )}

      {useRandomContent && (
        <Card className="p-4 bg-purple-500/5 border-purple-500/20">
          <p className="text-sm text-muted-foreground">
            <Shuffle className="h-4 w-4 inline mr-2 text-purple-500" />
            Wybór książek pominięty - posty ciekawostki będą generowane na podstawie podanego tematu.
          </p>
        </Card>
      )}

      {!canSubmit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Musisz wybrać co najmniej jedną książkę lub włączyć generowanie losowych treści
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
            <p className="text-sm text-muted-foreground">Posty ciekawostki ({contentRatio}%)</p>
            <p className="text-3xl font-bold text-blue-500">{contentPosts}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Posty sprzedażowe ({100 - contentRatio}%)</p>
            <p className="text-3xl font-bold text-green-500">{salesPosts}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Wybrane książki</p>
            <p className="text-3xl font-bold text-amber-500">{useRandomContent ? '-' : selectedBooks.length}</p>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Strategia {contentRatio}/{100 - contentRatio}:</strong>
          </p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• {contentRatio}% postów to ciekawostki (zagadki, wydarzenia historyczne)</li>
            <li>• {100 - contentRatio}% postów to bezpośrednia promocja i sprzedaż książek</li>
            <li>• {useAI ? "Grok AI automatycznie dobierze odpowiednie typy postów" : "Treści zostaną pobrane z opisów książek w bazie"}</li>
          </ul>
        </div>
        
        {exceedsXLimit && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Przekroczono limit X.com!</strong>
              <br />
              Kampania na X.com może mieć maksymalnie {X_MAX_CAMPAIGN_POSTS} postów (limit {X_DAILY_LIMIT} postów/dzień).
              <br />
              Aktualnie zaplanowano: <strong>{totalPosts} postów</strong>. Zmniejsz liczbę dni lub postów dziennie.
            </AlertDescription>
          </Alert>
        )}
      </Card>

      <Button onClick={handleSubmit} className="w-full" size="lg" disabled={!canSubmit}>
        {exceedsXLimit ? (
          <>
            <AlertCircle className="mr-2 h-4 w-4" />
            Przekroczono limit {X_MAX_CAMPAIGN_POSTS} postów dla X.com
          </>
        ) : (
          <>
            Przejdź do generowania planu
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
};