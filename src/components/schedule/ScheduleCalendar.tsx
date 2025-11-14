import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Twitter, Facebook, Instagram, Youtube, Linkedin, Clock } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

const platformIcons = {
  x: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
};

const platformColors = {
  x: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  facebook: "bg-blue-600/10 text-blue-600 border-blue-600/20",
  instagram: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  youtube: "bg-red-500/10 text-red-500 border-red-500/20",
  linkedin: "bg-blue-700/10 text-blue-700 border-blue-700/20",
};

export const ScheduleCalendar = () => {
  const { data: scheduledPosts, isLoading } = useQuery({
    queryKey: ["scheduled-posts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("book_platform_content")
        .select(`
          *,
          book:books(*)
        `)
        .eq("auto_publish_enabled", true)
        .eq("published", false)
        .not("scheduled_publish_at", "is", null)
        .order("scheduled_publish_at", { ascending: true });

      if (error) throw error;

      // Group by date
      const grouped = data.reduce((acc: any, post: any) => {
        const date = format(new Date(post.scheduled_publish_at), "yyyy-MM-dd");
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(post);
        return acc;
      }, {});

      return grouped;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const dates = scheduledPosts ? Object.keys(scheduledPosts).sort() : [];

  if (dates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Harmonogram publikacji</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Brak zaplanowanych publikacji
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {dates.map((date) => {
        const posts = scheduledPosts[date];
        const dateObj = new Date(date);

        return (
          <Card key={date}>
            <CardHeader>
              <CardTitle className="text-lg">
                {format(dateObj, "EEEE, d MMMM yyyy", { locale: pl })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {posts.map((post: any) => {
                  const Icon = platformIcons[post.platform as keyof typeof platformIcons] || Clock;
                  const colorClass = platformColors[post.platform as keyof typeof platformColors] || "bg-muted";
                  
                  return (
                    <div
                      key={post.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <img
                          src={post.book.image_url}
                          alt={post.book.title}
                          className="w-12 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={colorClass}>
                              <Icon className="h-3 w-3 mr-1" />
                              {post.platform}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {post.book.code}
                            </span>
                          </div>
                          <p className="font-medium text-sm line-clamp-1">
                            {post.book.title}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {format(new Date(post.scheduled_publish_at), "HH:mm")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
