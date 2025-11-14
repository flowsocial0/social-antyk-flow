import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, TrendingUp, CheckCircle2, Clock, Trash2, AlertCircle, Plus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CampaignDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [newPost, setNewPost] = useState({
    day: 1,
    time: "09:00",
    type: "content" as "content" | "sales",
    category: "trivia",
    text: "",
  });

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
      const { data, error } = await (supabase as any)
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
    const { data, error } = await (supabase as any)
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
    const { error } = await (supabase as any)
      .from('campaign_posts')
      .update({ text } as any)
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
    const { error } = await (supabase as any)
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

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await (supabase as any)
        .from('campaign_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-posts', id] });
      toast.success("Post został usunięty");
    },
    onError: () => {
      toast.error("Błąd podczas usuwania posta");
    },
  });

  const regeneratePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const post = posts?.find((p: any) => p.id === postId);
      if (!post) throw new Error("Post nie został znaleziony");

      const { data, error } = await supabase.functions.invoke('generate-campaign', {
        body: {
          action: 'generate_posts',
          structure: [{
            position: post.day,
            type: post.type,
            category: post.category,
          }],
        },
      });

      if (error) throw error;
      if (!data || !data.posts || data.posts.length === 0) {
        throw new Error("Nie udało się wygenerować tekstu");
      }

      const newText = data.posts[0].text;
      const { error: updateError } = await (supabase as any)
        .from('campaign_posts')
        .update({ text: newText } as any)
        .eq('id', postId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-posts', id] });
      toast.success("Tekst został zregenerowany");
    },
    onError: (error: any) => {
      console.error("Regeneration error:", error);
      toast.error("Błąd podczas regeneracji tekstu");
    },
  });

  const addPostMutation = useMutation({
    mutationFn: async () => {
      if (!campaign) throw new Error("Kampania nie została załadowana");
      
      // Calculate scheduled_at based on campaign start date, day and time
      const startDate = new Date(campaign.start_date);
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + newPost.day - 1);
      const [hours, minutes] = newPost.time.split(':').map(Number);
      scheduledDate.setHours(hours, minutes, 0, 0);

      const { error } = await (supabase as any)
        .from('campaign_posts')
        .insert({
          campaign_id: id,
          day: newPost.day,
          time: newPost.time,
          type: newPost.type,
          category: newPost.category,
          text: newPost.text,
          scheduled_at: scheduledDate.toISOString(),
          status: 'scheduled',
          platforms: campaign.target_platforms || ['x'],
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-posts', id] });
      toast.success("Post został dodany");
      setIsAddingPost(false);
      setNewPost({
        day: 1,
        time: "09:00",
        type: "content",
        category: "trivia",
        text: "",
      });
    },
    onError: () => {
      toast.error("Błąd podczas dodawania posta");
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ postId, scheduledAt }: { postId: string; scheduledAt: string }) => {
      const { error } = await (supabase as any)
        .from('campaign_posts')
        .update({ scheduled_at: scheduledAt } as any)
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-posts', id] });
      toast.success("Godzina publikacji zaktualizowana");
    },
    onError: () => {
      toast.error("Błąd podczas aktualizacji godziny publikacji");
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
  const postsByDay = (posts as any[]).reduce((acc: Record<number, any[]>, post: any) => {
    const day = post.day as number;
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(post);
    return acc;
  }, {} as Record<number, any[]>);

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
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Harmonogram postów</h2>
            <Dialog open={isAddingPost} onOpenChange={setIsAddingPost}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Dodaj post
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Dodaj nowy post</DialogTitle>
                  <DialogDescription>
                    Stwórz nowy post i dodaj go do harmonogramu kampanii
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="day">Dzień kampanii</Label>
                      <Input
                        id="day"
                        type="number"
                        min={1}
                        max={campaign.duration_days}
                        value={newPost.day}
                        onChange={(e) => setNewPost({ ...newPost, day: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Godzina</Label>
                      <Input
                        id="time"
                        type="time"
                        value={newPost.time}
                        onChange={(e) => setNewPost({ ...newPost, time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Typ posta</Label>
                      <Select
                        value={newPost.type}
                        onValueChange={(value: "content" | "sales") => setNewPost({ ...newPost, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="content">Content</SelectItem>
                          <SelectItem value="sales">Sprzedaż</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Kategoria</Label>
                      <Select
                        value={newPost.category}
                        onValueChange={(value) => setNewPost({ ...newPost, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trivia">Trivia</SelectItem>
                          <SelectItem value="quiz">Quiz</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="sales">Sprzedaż</SelectItem>
                          <SelectItem value="recommendation">Rekomendacja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text">Treść posta</Label>
                    <Textarea
                      id="text"
                      rows={8}
                      value={newPost.text}
                      onChange={(e) => setNewPost({ ...newPost, text: e.target.value })}
                      placeholder="Wpisz treść posta..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingPost(false)}>
                    Anuluj
                  </Button>
                  <Button
                    onClick={() => addPostMutation.mutate()}
                    disabled={!newPost.text.trim() || addPostMutation.isPending}
                  >
                    Dodaj post
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

  {Object.entries(postsByDay as Record<string, any[]>).map(([day, dayPosts]) => {
    const dayDate = new Date(campaign.start_date);
    dayDate.setDate(dayDate.getDate() + parseInt(day) - 1);

    return (
      <Card key={day} className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Dzień {day} - {format(dayDate, "EEEE, d MMMM yyyy", { locale: pl })}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(dayPosts as any[]).map((post) => (
            <CampaignPostCard
              key={post.id}
              post={post}
              onSave={async (postId, text) => {
                await updatePostMutation.mutateAsync({ postId, text });
              }}
              onRegenerate={async (postId) => {
                await regeneratePostMutation.mutateAsync(postId);
              }}
              onDelete={async (postId) => {
                await deletePostMutation.mutateAsync(postId);
              }}
              onUpdateSchedule={async (postId, scheduledAt) => {
                await updateScheduleMutation.mutateAsync({ postId, scheduledAt });
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
