import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Clock, Calendar, TrendingUp, AlertTriangle } from "lucide-react";
import { format, addMinutes } from "date-fns";
import { pl } from "date-fns/locale";

interface BulkScheduleDialogProps {
  unpublishedCount: number;
  onSchedule: (intervalMinutes: number, limitDays?: number, startTime?: Date) => void;
  isScheduling: boolean;
}

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

export const BulkScheduleDialog = ({ 
  unpublishedCount, 
  onSchedule, 
  isScheduling 
}: BulkScheduleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"interval" | "posts-per-day">("posts-per-day");
  const [intervalMinutes, setIntervalMinutes] = useState(160);
  const [postsPerDay, setPostsPerDay] = useState(9);
  const [limitDays, setLimitDays] = useState<number | undefined>(undefined);
  const [useLimitDays, setUseLimitDays] = useState(false);
  const [useStartTime, setUseStartTime] = useState(false);
  const [startTimeHour, setStartTimeHour] = useState("09");
  const [startTimeMinute, setStartTimeMinute] = useState("00");

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
    onSchedule(actualInterval, days, startTime);
    setOpen(false);
  };

  const getRateLimitWarning = () => {
    if (actualPostsPerDay >= 10) {
      return {
        level: "danger",
        message: "⚠️ UWAGA: Powyżej 10 postów/dzień - wysokie ryzyko rate limitów!",
        color: "text-red-600 dark:text-red-400"
      };
    }
    if (actualPostsPerDay >= 8) {
      return {
        level: "warning",
        message: "⚠️ Na granicy: 8-10 postów/dzień może powodować rate limity",
        color: "text-orange-600 dark:text-orange-400"
      };
    }
    if (actualPostsPerDay >= 4) {
      return {
        level: "safe",
        message: "✅ Bezpieczne: 4-7 postów/dzień - zalecane dla księgarni",
        color: "text-green-600 dark:text-green-400"
      };
    }
    return {
      level: "low",
      message: "ℹ️ Mało postów: zwiększ częstotliwość dla lepszego zasięgu",
      color: "text-blue-600 dark:text-blue-400"
    };
  };

  const rateLimitInfo = getRateLimitWarning();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={unpublishedCount === 0}>
          <Clock className="mr-2 h-4 w-4" />
          Zaplanuj wszystkie ({unpublishedCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Zaawansowane planowanie publikacji</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
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
          <div className={`rounded-lg p-3 border ${
            rateLimitInfo.level === "danger" ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" :
            rateLimitInfo.level === "warning" ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900" :
            rateLimitInfo.level === "safe" ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" :
            "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
          }`}>
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

          {/* Summary */}
          <div className="rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4 space-y-3">
            <div className="font-semibold text-base flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Podsumowanie planu
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Książek do zaplanowania:</span>
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
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Pierwsza publikacja:</span>
                <span className="font-bold">
                  {useStartTime 
                    ? format(getStartDateTime(), "dd.MM.yyyy 'o' HH:mm", { locale: pl })
                    : "Natychmiast"}
                </span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Ostatnia publikacja za:</span>
                <span className="font-bold">{calculateEndTime()}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {useStartTime 
              ? `Pierwsza książka zostanie opublikowana jutro o ${startTimeHour}:${startTimeMinute}, kolejne co ${actualInterval} minut.`
              : `Pierwsza książka zostanie opublikowana natychmiast, kolejne co ${actualInterval} minut.`}
          </p>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSchedule} disabled={isScheduling}>
              {isScheduling ? "Planowanie..." : "Zaplanuj"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
