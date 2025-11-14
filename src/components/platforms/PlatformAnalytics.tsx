import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Calendar, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PlatformAnalyticsProps {
  platform: string;
}

export const PlatformAnalytics = ({ platform }: PlatformAnalyticsProps) => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["platform-analytics", platform],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("book_platform_content")
        .select("*")
        .eq("platform", platform);

      if (error) throw error;

      // Calculate weekly stats
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const publishedLastWeek = data.filter((c: any) => {
        if (!c.published_at) return false;
        const publishedDate = new Date(c.published_at);
        return publishedDate >= weekAgo && publishedDate <= now;
      });

      // Create daily data for chart
      const dailyData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));
        
        const published = data.filter((c: any) => {
          if (!c.published_at) return false;
          const publishedDate = new Date(c.published_at);
          return publishedDate >= dayStart && publishedDate <= dayEnd;
        }).length;

        dailyData.push({
          date: dayStart.toLocaleDateString("pl-PL", { day: "numeric", month: "short" }),
          published,
        });
      }

      const total = data.length;
      const published = data.filter((c: any) => c.published).length;
      const scheduled = data.filter((c: any) => c.auto_publish_enabled && !c.published).length;
      const withAI = data.filter((c: any) => c.ai_generated_text).length;
      const publishedRate = total > 0 ? Math.round((published / total) * 100) : 0;
      const aiUsageRate = total > 0 ? Math.round((withAI / total) * 100) : 0;

      return {
        total,
        published,
        scheduled,
        withAI,
        publishedRate,
        aiUsageRate,
        publishedLastWeek: publishedLastWeek.length,
        dailyData,
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analityka</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      label: "Wskaźnik publikacji",
      value: `${analytics?.publishedRate}%`,
      icon: TrendingUp,
      color: "text-green-500",
      description: `${analytics?.published} z ${analytics?.total} opublikowanych`,
    },
    {
      label: "W ostatnim tygodniu",
      value: analytics?.publishedLastWeek || 0,
      icon: Calendar,
      color: "text-blue-500",
      description: "Publikacji w ostatnich 7 dniach",
    },
    {
      label: "Zaplanowane",
      value: analytics?.scheduled || 0,
      icon: Clock,
      color: "text-yellow-500",
      description: "Oczekujących na publikację",
    },
    {
      label: "Wykorzystanie AI",
      value: `${analytics?.aiUsageRate}%`,
      icon: Sparkles,
      color: "text-purple-500",
      description: `${analytics?.withAI} z ${analytics?.total} z tekstem AI`,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analityka szczegółowa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Publikacje w ostatnim tygodniu</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={analytics?.dailyData || []}>
                <defs>
                  <linearGradient id="colorPublished" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="published"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorPublished)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
