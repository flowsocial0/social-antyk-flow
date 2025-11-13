import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Clock, Calendar, TrendingUp, PlayCircle, LogOut } from "lucide-react";
import { PublicationMonitor } from "@/components/books/PublicationMonitor";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";

const INTERVAL_OPTIONS = [
  { label: "4 minuty", value: 4 },
  { label: "5 minut", value: 5 },
  { label: "15 minut", value: 15 },
  { label: "30 minut", value: 30 },
  { label: "1 godzina", value: 60 },
  { label: "2 godziny", value: 120 },
  { label: "4 godziny", value: 240 },
  { label: "8 godzin", value: 480 },
  { label: "12 godzin", value: 720 },
  { label: "24 godziny", value: 1440 },
];

const Schedule = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"interval" | "posts-per-day">("posts-per-day");
  const [intervalMinutes, setIntervalMinutes] = useState(160);
  const [postsPerDay, setPostsPerDay] = useState(9);
  const [limitDays, setLimitDays] = useState<number | undefined>(undefined);
  const [useLimitDays, setUseLimitDays] = useState(false);
  const [useStartTime, setUseStartTime] = useState(false);
  const [startTimeHour, setStartTimeHour] = useState("09");
  const [startTimeMinute, setStartTimeMinute] = useState("00");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data: countsData } = useQuery({
    queryKey: ["books-counts"],
    queryFn: async () => {
      const [unpublishedResult, scheduledResult] = await Promise.all([
        supabase.from("books").select("id", { count: "exact", head: true }).eq("published", false),
        supabase.from("books").select("id", { count: "exact", head: true }).eq("published", false).eq("auto_publish_enabled", true).not("scheduled_publish_at", "is", null)
      ]);
      return {
        unpublished: unpublishedResult.count || 0,
        scheduled: scheduledResult.count || 0
      };
    }
  });

  const bulkScheduleMutation = useMutation({
    mutationFn: async ({
      intervalMinutes,
      limitDays,
      startTime
    }: {
      intervalMinutes: number;
      limitDays?: number;
      startTime?: Date;
    }) => {
      const { data: allBooks, error: fetchError } = await supabase
        .from("books")
        .select("*")
        .eq("published", false)
        .order("code", { ascending: true });

      if (fetchError) throw fetchError;

      let unpublishedBooks = allBooks || [];

      if (limitDays) {
        const postsPerDay = Math.floor((24 * 60) / intervalMinutes);
        const maxBooks = postsPerDay * limitDays;
        unpublishedBooks = unpublishedBooks.slice(0, maxBooks);
      }

      const baseTime = startTime || new Date();

      const updates = unpublishedBooks.map((book, index) => {
        const scheduledAt = new Date(baseTime);
        scheduledAt.setMinutes(scheduledAt.getMinutes() + intervalMinutes * index);
        return supabase.from("books").update({
          scheduled_publish_at: scheduledAt.toISOString(),
          auto_publish_enabled: true
        }).eq("id", book.id);
      });
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`Nie udało się zaplanować ${errors.length} książek`);
      }
      return unpublishedBooks.length;
    },
    onSuccess: count => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["books-counts"] });
      queryClient.invalidateQueries({ queryKey: ["today-publication-stats"] });
      toast({
        title: "✅ Zaplanowano publikacje",
        description: `${count} książek zostanie opublikowanych automatycznie`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaplanować publikacji",
        variant: "destructive"
      });
    }
  });

  const cancelAllScheduledMutation = useMutation({
    mutationFn: async () => {
      const { data: allScheduledBooks, error: fetchError } = await supabase
        .from("books")
        .select("*")
        .eq("published", false)
        .eq("auto_publish_enabled", true)
        .not("scheduled_publish_at", "is", null);

      if (fetchError) throw fetchError;

      const scheduledBooks = allScheduledBooks || [];

      const updates = scheduledBooks.map((book) =>
        supabase.from("books").update({
          scheduled_publish_at: null,
          auto_publish_enabled: false
        }).eq("id", book.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`Nie udało się anulować ${errors.length} publikacji`);
      }
      return scheduledBooks.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["books-counts"] });
      queryClient.invalidateQueries({ queryKey: ["today-publication-stats"] });
      toast({
        title: "✅ Anulowano publikacje",
        description: `Anulowano ${count} zaplanowanych publikacji`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się anulować publikacji",
        variant: "destructive"
      });
    }
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Wylogowano",
      description: "Do zobaczenia!",
    });
  };

  const calculateInterval = () => {
    if (mode === "posts-per-day") {
      return Math.floor((24 * 60) / postsPerDay);
    }
    return intervalMinutes;
  };

  const calculatePostsPerDay = (interval: number) => {
    return Math.floor((24 * 60) / interval);
  };

  const actualInterval = calculateInterval();
  const actualPostsPerDay = calculatePostsPerDay(actualInterval);
  const unpublishedCount = countsData?.unpublished || 0;
  const scheduledCount = countsData?.scheduled || 0;
  const booksToSchedule = useLimitDays && limitDays 
    ? Math.min(actualPostsPerDay * limitDays, unpublishedCount)
    : unpublishedCount;
  const totalDays = Math.ceil(booksToSchedule / actualPostsPerDay);

  const getStartDateTime = () => {
    if (!useStartTime) return new Date();
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(parseInt(startTimeHour), parseInt(startTimeMinute), 0, 0);
    return tomorrow;
  };

  const calculateEndTime = () => {
    const totalMinutes = actualInterval * (booksToSchedule - 1);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days > 0) {
      return `${days}d ${remainingHours}h ${minutes > 0 ? `${minutes}min` : ''}`;
    }
    if (remainingHours > 0) {
      return `${remainingHours}h ${minutes > 0 ? `${minutes}min` : ''}`;
    }
    return `${minutes} min`;
  };

  const handleSchedule = () => {
    const startTime = useStartTime ? getStartDateTime() : undefined;
    const days = useLimitDays ? limitDays : undefined;
    bulkScheduleMutation.mutate({
      intervalMinutes: actualInterval,
      limitDays: days,
      startTime
    });
  };

  const getRateLimitWarning = () => {
    if (actualPostsPerDay >= 10) {
      return {
        level: "danger",
        message: "⚠️ UWAGA: Powyżej 10 postów/dzień - wysokie ryzyko rate limitów!",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
      };
    }
    if (actualPostsPerDay >= 8) {
      return {
        level: "warning",
        message: "⚠️ Na granicy: 8-10 postów/dzień może powodować rate limity",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900"
      };
    }
    if (actualPostsPerDay >= 4) {
      return {
        level: "safe",
        message: "✅ Bezpieczne: 4-7 postów/dzień - zalecane dla księgarni",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
      };
    }
    return {
      level: "low",
      message: "ℹ️ Mało postów: zwiększ częstotliwość dla lepszego zasięgu",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
    };
  };

  const rateLimitInfo = getRateLimitWarning();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Ładowanie...</p>
    </div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-gradient-primary shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-primary-foreground">Planowanie Postów</h1>
                <p className="text-sm text-primary-foreground/90 mt-1">Zaawansowane narzędzie do harmonogramu publikacji</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <LogOut className="mr-2 h-4 w-4" />
              Wyloguj
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Monitor */}
        <PublicationMonitor />

        {/* Planning Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Settings */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Konfiguracja harmonogramu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Mode Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Tryb planowania</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={mode === "posts-per-day" ? "default" : "outline"}
                      onClick={() => setMode("posts-per-day")}
                      className="flex-1"
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Postów dziennie
                    </Button>
                    <Button
                      type="button"
                      variant={mode === "interval" ? "default" : "outline"}
                      onClick={() => setMode("interval")}
                      className="flex-1"
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Interwał czasowy
                    </Button>
                  </div>
                </div>

                {/* Posts Per Day Mode */}
                {mode === "posts-per-day" && (
                  <div className="space-y-2">
                    <Label htmlFor="posts-per-day" className="text-sm font-medium">
                      Liczba postów dziennie
                    </Label>
                    <Input
                      id="posts-per-day"
                      type="number"
                      min={1}
                      max={24}
                      value={postsPerDay}
                      onChange={(e) => setPostsPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-lg font-semibold"
                    />
                    <p className="text-xs text-muted-foreground">
                      = co {actualInterval} minut
                    </p>
                  </div>
                )}

                {/* Interval Mode */}
                {mode === "interval" && (
                  <div className="space-y-2">
                    <Label htmlFor="interval" className="text-sm font-medium">
                      Odstęp między publikacjami
                    </Label>
                    <Select
                      value={intervalMinutes.toString()}
                      onValueChange={(value) => setIntervalMinutes(parseInt(value))}
                    >
                      <SelectTrigger id="interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVAL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      = {actualPostsPerDay} postów dziennie
                    </p>
                  </div>
                )}

                {/* Rate Limit Warning */}
                <div className={`rounded-lg p-4 border ${rateLimitInfo.bgColor}`}>
                  <p className={`text-sm font-medium ${rateLimitInfo.color}`}>
                    {rateLimitInfo.message}
                  </p>
                </div>

                {/* Limit Days */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="limit-days-toggle" className="text-sm font-medium">
                      Ogranicz do określonej liczby dni
                    </Label>
                    <Switch
                      id="limit-days-toggle"
                      checked={useLimitDays}
                      onCheckedChange={setUseLimitDays}
                    />
                  </div>
                  {useLimitDays && (
                    <Input
                      type="number"
                      min={1}
                      value={limitDays || ""}
                      onChange={(e) => setLimitDays(parseInt(e.target.value) || undefined)}
                      placeholder="Liczba dni (np. 7)"
                    />
                  )}
                </div>

                {/* Start Time */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="start-time-toggle" className="text-sm font-medium">
                      Ustaw godzinę pierwszej publikacji
                    </Label>
                    <Switch
                      id="start-time-toggle"
                      checked={useStartTime}
                      onCheckedChange={setUseStartTime}
                    />
                  </div>
                  {useStartTime && (
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={startTimeHour}
                        onChange={(e) => setStartTimeHour(e.target.value.padStart(2, '0'))}
                        className="w-20"
                        placeholder="GG"
                      />
                      <span className="text-lg font-bold">:</span>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={startTimeMinute}
                        onChange={(e) => setStartTimeMinute(e.target.value.padStart(2, '0'))}
                        className="w-20"
                        placeholder="MM"
                      />
                      <span className="text-sm text-muted-foreground ml-2">(jutro)</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary & Actions */}
          <div className="space-y-6">
            {/* Summary */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Podsumowanie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Książek dostępnych:</span>
                  <span className="font-bold">{unpublishedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Do zaplanowania:</span>
                  <span className="font-bold">{booksToSchedule}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Postów dziennie:</span>
                  <span className="font-bold">{actualPostsPerDay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interwał:</span>
                  <span className="font-bold">co {actualInterval} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Okres publikacji:</span>
                  <span className="font-bold">{totalDays} {totalDays === 1 ? 'dzień' : 'dni'}</span>
                </div>
                <div className="pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-1">Pierwsza publikacja:</div>
                  <div className="font-bold">
                    {useStartTime 
                      ? `Jutro o ${startTimeHour}:${startTimeMinute}`
                      : "Natychmiast"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Ostatnia za:</div>
                  <div className="font-bold">{calculateEndTime()}</div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Akcje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={handleSchedule} 
                  disabled={bulkScheduleMutation.isPending || unpublishedCount === 0}
                  className="w-full"
                  size="lg"
                >
                  <PlayCircle className="mr-2 h-5 w-5" />
                  {bulkScheduleMutation.isPending ? "Planowanie..." : "Zaplanuj publikacje"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => cancelAllScheduledMutation.mutate()}
                  disabled={scheduledCount === 0 || cancelAllScheduledMutation.isPending}
                  className="w-full"
                >
                  {cancelAllScheduledMutation.isPending ? "Anulowanie..." : `Anuluj wszystkie (${scheduledCount})`}
                </Button>

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    {useStartTime 
                      ? `Pierwsza książka zostanie opublikowana jutro o ${startTimeHour}:${startTimeMinute}, kolejne co ${actualInterval} minut.`
                      : `Pierwsza książka zostanie opublikowana natychmiast, kolejne co ${actualInterval} minut.`}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Zaplanowane:</span>
                  <span className="font-bold text-orange-600">{scheduledCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Niezaplanowane:</span>
                  <span className="font-bold text-blue-600">{unpublishedCount - scheduledCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Schedule;
