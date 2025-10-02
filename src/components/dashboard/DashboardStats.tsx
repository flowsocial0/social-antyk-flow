import { Card } from "@/components/ui/card";
import { BookOpen, Calendar, TrendingUp, Activity } from "lucide-react";

export const DashboardStats = () => {
  const stats = [
    {
      title: "Total Books",
      value: "0",
      icon: BookOpen,
      description: "In library",
      trend: "+0 this week"
    },
    {
      title: "Scheduled Posts",
      value: "0",
      icon: Calendar,
      description: "Next 7 days",
      trend: "0 today"
    },
    {
      title: "Published",
      value: "0",
      icon: TrendingUp,
      description: "This month",
      trend: "+0% vs last month"
    },
    {
      title: "Active Platforms",
      value: "0/3",
      icon: Activity,
      description: "Connected",
      trend: "Facebook, X, Instagram"
    }
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card 
            key={index} 
            className="p-6 bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <h3 className="text-3xl font-bold bg-gradient-accent bg-clip-text text-transparent">
                  {stat.value}
                </h3>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">{stat.trend}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
