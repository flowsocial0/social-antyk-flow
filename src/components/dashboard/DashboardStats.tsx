import { Card } from "@/components/ui/card";
import { BookOpen, Calendar, TrendingUp, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const DashboardStats = () => {
  // Fetch all books
  const { data: books } = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // 5 minutes
    refetchInterval: 300000 // Refetch every 5 minutes
  });

  // Fetch scheduled posts (next 7 days)
  const { data: scheduledBooks } = useQuery({
    queryKey: ["scheduled-books"],
    queryFn: async () => {
      const now = new Date();
      const next7Days = new Date();
      next7Days.setDate(now.getDate() + 7);

      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("published", false)
        .eq("auto_publish_enabled", true)
        .gte("scheduled_publish_at", now.toISOString())
        .lte("scheduled_publish_at", next7Days.toISOString());
      
      if (error) throw error;
      return data;
    },
    staleTime: 180000, // 3 minutes
    refetchInterval: 180000 // Refetch every 3 minutes
  });

  // Fetch published this month
  const { data: publishedThisMonth } = useQuery({
    queryKey: ["published-this-month"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("published", true)
        .gte("updated_at", startOfMonth.toISOString());
      
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // 5 minutes
    refetchInterval: 300000 // Refetch every 5 minutes
  });

  // Check Twitter connection
  const { data: twitterTokens } = useQuery({
    queryKey: ["twitter-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twitter_oauth_tokens")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    staleTime: 600000, // 10 minutes
    refetchInterval: false // Don't auto-refetch, only on mount/focus
  });

  const totalBooks = books?.length || 0;
  const scheduledCount = scheduledBooks?.length || 0;
  const publishedCount = publishedThisMonth?.length || 0;
  const connectedPlatforms = twitterTokens ? 1 : 0;

  const stats = [
    {
      title: "Wszystkie książki",
      value: totalBooks.toString(),
      icon: BookOpen,
      description: "W bibliotece",
      trend: "+0 w tym tygodniu"
    },
    {
      title: "Zaplanowane posty",
      value: scheduledCount.toString(),
      icon: Calendar,
      description: "Następne 7 dni",
      trend: "0 dzisiaj"
    },
    {
      title: "Opublikowane",
      value: publishedCount.toString(),
      icon: TrendingUp,
      description: "W tym miesiącu",
      trend: "+0% vs. ostatni miesiąc"
    },
    {
      title: "Aktywne platformy",
      value: `${connectedPlatforms}/3`,
      icon: Activity,
      description: "Połączone",
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
