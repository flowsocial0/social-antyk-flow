import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Send, Calendar, Clock } from "lucide-react";

interface PlatformStatsProps {
  platform: string;
}

export const PlatformStats = ({ platform }: PlatformStatsProps) => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-stats", platform],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("book_platform_content")
        .select("*")
        .eq("platform", platform);

      if (error) throw error;

      const total = data.length;
      const published = data.filter((c: any) => c.published).length;
      const scheduled = data.filter((c: any) => c.auto_publish_enabled && !c.published).length;
      const withAI = data.filter((c: any) => c.ai_generated_text).length;

      // Get last published
      const lastPublished = data
        .filter((c: any) => c.published && c.published_at)
        .sort((a: any, b: any) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())[0];

      return {
        total,
        published,
        scheduled,
        withAI,
        lastPublished: lastPublished?.published_at,
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statystyki</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      label: "Wszystkie posty",
      value: stats?.total || 0,
      icon: FileText,
      color: "text-blue-500",
    },
    {
      label: "Opublikowane",
      value: stats?.published || 0,
      icon: Send,
      color: "text-green-500",
    },
    {
      label: "Zaplanowane",
      value: stats?.scheduled || 0,
      icon: Calendar,
      color: "text-yellow-500",
    },
    {
      label: "Z tekstem AI",
      value: stats?.withAI || 0,
      icon: FileText,
      color: "text-purple-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statystyki</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {statItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
            );
          })}
        </div>

        {stats?.lastPublished && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Ostatnia publikacja:</span>
            </div>
            <p className="text-sm font-medium mt-1">
              {new Date(stats.lastPublished).toLocaleString("pl-PL")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
