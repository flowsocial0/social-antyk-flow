import { Card } from "@/components/ui/card";
import { BookOpen, Calendar, TrendingUp, Activity, Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DashboardStats = () => {
  // Fetch active campaigns count
  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, status");
      if (error) throw error;
      return {
        total: data?.length || 0,
        active: data?.filter(c => c.status === 'active').length || 0
      };
    },
    staleTime: 300000,
    refetchInterval: 300000,
  });

  // Fetch scheduled campaign posts (next 7 days)
  const { data: scheduledPosts } = useQuery({
    queryKey: ["scheduled-campaign-posts"],
    queryFn: async () => {
      const now = new Date();
      const next7Days = new Date();
      next7Days.setDate(now.getDate() + 7);

      const { data, error } = await supabase
        .from("campaign_posts")
        .select("id")
        .eq("status", "scheduled")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", next7Days.toISOString());

      if (error) throw error;
      return data;
    },
    staleTime: 180000,
    refetchInterval: 180000,
  });

  // Fetch published campaign posts this month
  const { data: publishedThisMonth } = useQuery({
    queryKey: ["published-campaign-posts-this-month"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data, error } = await supabase
        .from("campaign_posts")
        .select("id")
        .eq("status", "published")
        .gte("published_at", startOfMonth.toISOString());

      if (error) throw error;
      return data;
    },
    staleTime: 300000,
    refetchInterval: 300000,
  });

  // Fetch total published all time
  const { data: totalPublished } = useQuery({
    queryKey: ["total-published-campaign-posts"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("campaign_posts")
        .select("*", { count: "exact", head: true })
        .eq("status", "published");

      if (error) throw error;
      return count || 0;
    },
    staleTime: 300000,
    refetchInterval: 300000,
  });

  const activeCampaigns = campaignsData?.active || 0;
  const totalCampaigns = campaignsData?.total || 0;
  const scheduledCount = scheduledPosts?.length || 0;
  const publishedMonthCount = publishedThisMonth?.length || 0;
  const publishedTotalCount = totalPublished || 0;

  const stats = [
    {
      title: "Aktywne kampanie",
      value: activeCampaigns.toString(),
      icon: Megaphone,
      description: `z ${totalCampaigns} wszystkich`,
      trend: "Publikacje automatyczne",
    },
    {
      title: "Zaplanowane posty",
      value: scheduledCount.toString(),
      icon: Calendar,
      description: "Następne 7 dni",
      trend: "W ramach kampanii",
    },
    {
      title: "Opublikowane (miesiąc)",
      value: publishedMonthCount.toString(),
      icon: TrendingUp,
      description: "W tym miesiącu",
      trend: `${publishedTotalCount} łącznie`,
    },
    {
      title: "Aktywne platformy",
      value: `4/13`,
      icon: Activity,
      description: "Połączone",
      trend: "X, Facebook, TikTok, Instagram",
    },
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
                <h3 className="text-3xl font-bold bg-gradient-accent bg-clip-text text-transparent">{stat.value}</h3>
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
