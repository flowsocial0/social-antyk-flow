import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

export const RecentActivity = () => {
  const activities = [{
    type: "info",
    message: "Witaj w SocialFlow! Połącz swoją bazę danych Supabase, aby rozpocząć.",
    time: "Przed chwilą",
    platform: "System"
  }];
  
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5" />
        Ostatnia aktywność
      </h3>
      <div className="space-y-3">
        {activities.map((activity, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{activity.platform}</Badge>
              <span className="text-sm">{activity.message}</span>
            </div>
            <span className="text-xs text-muted-foreground">{activity.time}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};