import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, CheckCircle, Calendar } from "lucide-react";
import { format, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { pl } from "date-fns/locale";

export const PublicationMonitor = () => {
  const { data: todayStats } = useQuery({
    queryKey: ["today-publication-stats"],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // Get books scheduled for today
      const { data: scheduledToday, error: scheduledError } = await supabase
        .from("books")
        .select("*")
        .gte("scheduled_publish_at", startOfToday.toISOString())
        .lte("scheduled_publish_at", endOfToday.toISOString())
        .eq("auto_publish_enabled", true)
        .order("scheduled_publish_at", { ascending: true });

      if (scheduledError) throw scheduledError;

      const published = scheduledToday?.filter(b => b.published) || [];
      const pending = scheduledToday?.filter(b => !b.published) || [];
      
      // Find next publication
      const nextPublication = pending[0];
      const minutesUntilNext = nextPublication 
        ? differenceInMinutes(new Date(nextPublication.scheduled_publish_at!), new Date())
        : null;

      return {
        totalScheduled: scheduledToday?.length || 0,
        published: published.length,
        pending: pending.length,
        nextPublication,
        minutesUntilNext
      };
    },
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000 // Consider data fresh for 1 minute
  });

  if (!todayStats || todayStats.totalScheduled === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Monitorowanie publikacji dzisiaj
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Scheduled */}
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-background/50 border border-border">
            <Calendar className="h-6 w-6 text-muted-foreground mb-2" />
            <div className="text-2xl font-bold text-foreground">{todayStats.totalScheduled}</div>
            <div className="text-xs text-muted-foreground text-center">Zaplanowane na dziś</div>
          </div>

          {/* Published */}
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="h-6 w-6 text-green-600 mb-2" />
            <div className="text-2xl font-bold text-green-700 dark:text-green-500">{todayStats.published}</div>
            <div className="text-xs text-muted-foreground text-center">Opublikowane</div>
          </div>

          {/* Pending */}
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <Clock className="h-6 w-6 text-orange-600 mb-2" />
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-500">{todayStats.pending}</div>
            <div className="text-xs text-muted-foreground text-center">Pozostało</div>
          </div>

          {/* Next Publication */}
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Clock className="h-6 w-6 text-blue-600 mb-2" />
            {todayStats.nextPublication ? (
              <>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-500">
                  {todayStats.minutesUntilNext! > 0 
                    ? `za ${todayStats.minutesUntilNext} min`
                    : "teraz"}
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  Kolejna: {format(new Date(todayStats.nextPublication.scheduled_publish_at!), "HH:mm", { locale: pl })}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-muted-foreground">-</div>
                <div className="text-xs text-muted-foreground text-center">Brak kolejnej</div>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Postęp dzisiaj</span>
            <span className="text-xs font-medium">
              {todayStats.totalScheduled > 0 
                ? Math.round((todayStats.published / todayStats.totalScheduled) * 100)
                : 0}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-primary h-full transition-all duration-500 ease-out"
              style={{ 
                width: `${todayStats.totalScheduled > 0 
                  ? (todayStats.published / todayStats.totalScheduled) * 100 
                  : 0}%` 
              }}
            />
          </div>
        </div>

        {/* Next book preview */}
        {todayStats.nextPublication && (
          <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Następna publikacja:</div>
            <div className="font-medium text-sm line-clamp-1">{todayStats.nextPublication.title}</div>
            <Badge variant="outline" className="mt-1 text-xs">
              {todayStats.nextPublication.code}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
