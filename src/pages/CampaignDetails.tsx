import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, TrendingUp, CheckCircle2, Clock, Trash2, AlertCircle } from "lucide-react";
import { CampaignPostCard } from "@/components/campaigns/CampaignPostCard";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const CampaignDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['campaign-posts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_posts')
        .select(`
          *,
          book:books(id, title, image_url, product_url)
        `)
        .eq('campaign_id', id)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ postId, text }: { postId: string; text: string }) => {
      const { error } = await supabase
        .from('campaign_posts')
        .update({ text })
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-posts', id] });
      toast.success("Post zaktualizowany");
    },
    onError: () => {
      toast.error("Błąd podczas aktualizacji posta");
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kampania została usunięta");
      navigate('/campaigns');
    },
    onError: () => {
      toast.error("Błąd podczas usuwania kampanii");
    },
  });

  if (campaignLoading || postsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Ładowanie szczegółów kampanii...</p>
      </div>
    );
  }

  if (!campaign || !posts) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Nie znaleziono kampanii</p>
      </div>
    );
  }

  const publishedCount = posts.filter(p => p.status === 'published').length;
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length;
  const failedCount = posts.filter(p => p.status === 'failed').length;
  const progress = posts.length > 0 ? (publishedCount / posts.length) * 100 : 0;

  // Group posts by day
  const postsByDay = posts.reduce((acc, post) => {
    const day = post.day;
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(post);
    return acc;
  }, {} as Record<number, typeof posts>);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Szkic</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" /> Zaplanowana</Badge>;
      case 'active':
        return <Badge className="gap-1 bg-gradient-primary"><TrendingUp className="h-3 w-3" /> Aktywna</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3" /> Zakończona</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="gap-1 bg-red-500/10 text-red-600 border-red-500/20"><AlertCircle className="h-3 w-3" /> Anulowana</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-gradient-primary shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/campaigns")}
                className="text-primary-foreground hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Powrót do kampanii
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-primary-foreground">{campaign.name}</h1>
                <p className="text-sm text-primary-foreground/90 mt-1">
                  {campaign.description || "Szczegóły kampanii"}
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Usuń kampanię
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Czy na pewno chcesz usunąć tę kampanię?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ta akcja jest nieodwracalna. Zostaną usunięte wszystkie posty związane z tą kampanią.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anuluj</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteCampaignMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Usuń
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Summary Card */}
        <Card className="p-6 mb-8 bg-gradient-card border-border/50 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Podsumowanie kampanii</h2>
            {getStatusBadge(campaign.status)}
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Zakres dat</p>
              <p className="font-semibold">
                {format(new Date(campaign.start_date), "d MMM", { locale: pl })} -{" "}
                {format(
                  new Date(new Date(campaign.start_date).getTime() + campaign.duration_days * 24 * 60 * 60 * 1000),
                  "d MMM yyyy",
                  { locale: pl }
                )}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Łączna liczba postów</p>
              <p className="font-semibold text-2xl">{posts.length}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Posty contentowe / Sprzedażowe</p>
              <p className="font-semibold">
                {campaign.content_posts_count} / {campaign.sales_posts_count}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Częstotliwość</p>
              <p className="font-semibold">{campaign.posts_per_day} postów/dzień</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Postęp publikacji</span>
              <span className="font-semibold">
                {publishedCount} / {posts.length} ({Math.round(progress)}%)
              </span>
            </div>
            <Progress value={progress} className="h-3" />

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{publishedCount} opublikowanych</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span>{scheduledCount} zaplanowanych</span>
              </div>
              {failedCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span>{failedCount} błędów</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Posts Schedule */}
        <div className="space-y-8">
          <h2 className="text-2xl font-semibold">Harmonogram postów</h2>

          {Object.entries(postsByDay).map(([day, dayPosts]) => {
            const dayDate = new Date(campaign.start_date);
            dayDate.setDate(dayDate.getDate() + parseInt(day) - 1);

            return (
              <Card key={day} className="p-6 bg-gradient-card border-border/50">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Dzień {day} - {format(dayDate, "EEEE, d MMMM yyyy", { locale: pl })}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {dayPosts.map((post) => (
                    <CampaignPostCard
                      key={post.id}
                      post={post}
                      onSave={async (postId, text) => {
                        await updatePostMutation.mutateAsync({ postId, text });
                      }}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default CampaignDetails;
