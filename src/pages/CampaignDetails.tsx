import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  Trash2,
  AlertCircle,
  Plus,
  RefreshCw,
  Pencil,
  Pause,
  Copy,
  Users,
  Image as ImageIcon,
  Video,
  X,
} from "lucide-react";
import { CampaignPostCard } from "@/components/campaigns/CampaignPostCard";
import { ResumeCampaignDialog } from "@/components/campaigns/ResumeCampaignDialog";
import { CopyCampaignDialog } from "@/components/campaigns/CopyCampaignDialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPlatformConfig, PlatformId } from "@/config/platforms";

// Helper function to sanitize filenames for storage
const sanitizeFileName = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, c => ({
      'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
      'Ą':'A','Ć':'C','Ę':'E','Ł':'L','Ń':'N','Ó':'O','Ś':'S','Ź':'Z','Ż':'Z'
    })[c] || c)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
};

interface AccountInfo {
  id: string;
  display_name: string;
  platform: string;
}

const CampaignDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [isEditNameDialogOpen, setIsEditNameDialogOpen] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [accountsMap, setAccountsMap] = useState<Record<string, AccountInfo>>({});
  const [newPost, setNewPost] = useState({
    day: 1,
    time: "09:00",
    type: "content" as "content" | "sales",
    category: "trivia",
    text: "",
  });
  const [newPostMediaFile, setNewPostMediaFile] = useState<File | null>(null);
  const [newPostMediaPreview, setNewPostMediaPreview] = useState<string>('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const handleNewPostMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPostMediaFile(file);
      const previewUrl = URL.createObjectURL(file);
      setNewPostMediaPreview(previewUrl);
    }
  };

  const clearNewPostMedia = () => {
    if (newPostMediaPreview) {
      URL.revokeObjectURL(newPostMediaPreview);
    }
    setNewPostMediaFile(null);
    setNewPostMediaPreview('');
  };

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
    queryKey: ["campaign", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("campaigns").select("*").eq("id", id).single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Load account info for displaying selected accounts
  useEffect(() => {
    const loadAccountsInfo = async () => {
      if (!campaign?.selected_accounts) return;

      const selectedAccounts = campaign.selected_accounts as Record<string, string[]>;
      const allAccountIds = Object.values(selectedAccounts).flat();
      
      if (allAccountIds.length === 0) return;

      const newAccountsMap: Record<string, AccountInfo> = {};

      // Load X accounts
      if (selectedAccounts.x?.length) {
        const { data } = await supabase
          .from('twitter_oauth1_tokens')
          .select('id, screen_name, account_name')
          .in('id', selectedAccounts.x);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.screen_name ? `@${a.screen_name}` : (a.account_name || 'Konto X'),
            platform: 'x'
          };
        });
      }

      // Load Facebook accounts
      if (selectedAccounts.facebook?.length) {
        const { data } = await (supabase as any)
          .from('facebook_oauth_tokens')
          .select('id, page_name, account_name')
          .in('id', selectedAccounts.facebook);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.page_name || a.account_name || 'Strona Facebook',
            platform: 'facebook'
          };
        });
      }

      // Load Instagram accounts
      if (selectedAccounts.instagram?.length) {
        const { data } = await (supabase as any)
          .from('instagram_oauth_tokens')
          .select('id, instagram_username, account_name')
          .in('id', selectedAccounts.instagram);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.instagram_username ? `@${a.instagram_username}` : (a.account_name || 'Konto Instagram'),
            platform: 'instagram'
          };
        });
      }

      // Load TikTok accounts
      if (selectedAccounts.tiktok?.length) {
        const { data } = await (supabase as any)
          .from('tiktok_oauth_tokens')
          .select('id, account_name, open_id')
          .in('id', selectedAccounts.tiktok);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.account_name || a.open_id?.substring(0, 8) || 'Konto TikTok',
            platform: 'tiktok'
          };
        });
      }

      // Load YouTube accounts
      if (selectedAccounts.youtube?.length) {
        const { data } = await (supabase as any)
          .from('youtube_oauth_tokens')
          .select('id, channel_title, account_name')
          .in('id', selectedAccounts.youtube);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.channel_title || a.account_name || 'Kanał YouTube',
            platform: 'youtube'
          };
        });
      }

      // Load LinkedIn accounts
      if (selectedAccounts.linkedin?.length) {
        const { data } = await (supabase as any)
          .from('linkedin_oauth_tokens')
          .select('id, display_name, account_name')
          .in('id', selectedAccounts.linkedin);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.display_name || a.account_name || 'Profil LinkedIn',
            platform: 'linkedin'
          };
        });
      }

      // Load Threads accounts
      if (selectedAccounts.threads?.length) {
        const { data } = await (supabase as any)
          .from('threads_oauth_tokens')
          .select('id, username, account_name')
          .in('id', selectedAccounts.threads);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.username ? `@${a.username}` : (a.account_name || 'Konto Threads'),
            platform: 'threads'
          };
        });
      }

      // Load Telegram accounts
      if (selectedAccounts.telegram?.length) {
        const { data } = await (supabase as any)
          .from('telegram_tokens')
          .select('id, channel_name, chat_id, account_name')
          .in('id', selectedAccounts.telegram);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.channel_name || a.account_name || `Chat ${a.chat_id}`,
            platform: 'telegram'
          };
        });
      }

      // Load Bluesky accounts
      if (selectedAccounts.bluesky?.length) {
        const { data } = await (supabase as any)
          .from('bluesky_tokens')
          .select('id, handle, account_name')
          .in('id', selectedAccounts.bluesky);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.handle ? `@${a.handle}` : (a.account_name || 'Konto Bluesky'),
            platform: 'bluesky'
          };
        });
      }

      // Load Mastodon accounts
      if (selectedAccounts.mastodon?.length) {
        const { data } = await (supabase as any)
          .from('mastodon_tokens')
          .select('id, username, server_url, account_name')
          .in('id', selectedAccounts.mastodon);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.username ? `@${a.username}@${a.server_url?.replace('https://', '')}` : (a.account_name || 'Konto Mastodon'),
            platform: 'mastodon'
          };
        });
      }

      // Load Gab accounts
      if (selectedAccounts.gab?.length) {
        const { data } = await (supabase as any)
          .from('gab_tokens')
          .select('id, username, account_name')
          .in('id', selectedAccounts.gab);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.username ? `@${a.username}` : (a.account_name || 'Konto Gab'),
            platform: 'gab'
          };
        });
      }

      // Load Pinterest accounts
      if (selectedAccounts.pinterest?.length) {
        const { data } = await (supabase as any)
          .from('pinterest_oauth_tokens')
          .select('id, username, account_name')
          .in('id', selectedAccounts.pinterest);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.username ? `@${a.username}` : (a.account_name || 'Konto Pinterest'),
            platform: 'pinterest'
          };
        });
      }

      // Load Reddit accounts
      if (selectedAccounts.reddit?.length) {
        const { data } = await (supabase as any)
          .from('reddit_oauth_tokens')
          .select('id, username, account_name')
          .in('id', selectedAccounts.reddit);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.username ? `u/${a.username}` : (a.account_name || 'Konto Reddit'),
            platform: 'reddit'
          };
        });
      }

      setAccountsMap(newAccountsMap);
    };

    loadAccountsInfo();
  }, [campaign?.selected_accounts]);

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["campaign-posts", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("campaign_posts")
        .select(
          `
        *,
        book:books(id, title, image_url, storage_path, product_url)
      `,
        )
        .eq("campaign_id", id)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ postId, text }: { postId: string; text: string }) => {
      const { error } = await (supabase as any)
        .from("campaign_posts")
        .update({ text } as any)
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-posts", id] });
      toast.success("Post zaktualizowany");
    },
    onError: () => {
      toast.error("Błąd podczas aktualizacji posta");
    },
  });

  const updateCampaignNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await (supabase as any).from("campaigns").update({ name: newName }).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      toast.success("Nazwa kampanii została zaktualizowana");
      setIsEditNameDialogOpen(false);
    },
    onError: () => {
      toast.error("Błąd podczas aktualizacji nazwy kampanii");
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("campaigns").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kampania została usunięta");
      navigate("/campaigns");
    },
    onError: () => {
      toast.error("Błąd podczas usuwania kampanii");
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await (supabase as any).from("campaign_posts").delete().eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-posts", id] });
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

      const { data, error } = await supabase.functions.invoke("generate-campaign", {
        body: {
          action: "generate_posts",
          structure: [
            {
              position: post.day,
              type: post.type,
              category: post.category,
            },
          ],
        },
      });

      if (error) throw error;
      if (!data || !data.posts || data.posts.length === 0) {
        throw new Error("Nie udało się wygenerować tekstu");
      }

      const newText = data.posts[0].text;
      const { error: updateError } = await (supabase as any)
        .from("campaign_posts")
        .update({ text: newText } as any)
        .eq("id", postId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-posts", id] });
      toast.success("Tekst został zregenerowany");
    },
    onError: (error: any) => {
      console.error("Regeneration error:", error);
      toast.error("Błąd podczas regeneracji tekstu");
    },
  });

  const addPostMutation = useMutation({
    mutationFn: async () => {
      if (!campaign || !user) throw new Error("Kampania nie została załadowana");

      setIsUploadingMedia(true);
      let mediaUrl: string | null = null;

      // Upload media if present
      if (newPostMediaFile) {
        const isVideo = newPostMediaFile.type.startsWith('video/');
        const folder = isVideo ? 'videos' : 'images';
        const fileName = `${user.id}/${folder}/${Date.now()}_${sanitizeFileName(newPostMediaFile.name)}`;
        
        const { error: uploadError } = await supabase.storage
          .from('ObrazkiKsiazek')
          .upload(fileName, newPostMediaFile, { upsert: true });
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Błąd podczas przesyłania pliku');
        }
        
        const { data: publicUrlData } = supabase.storage
          .from('ObrazkiKsiazek')
          .getPublicUrl(fileName);
        
        mediaUrl = publicUrlData.publicUrl;
      }

      // Calculate scheduled_at based on campaign start date, day and time
      const startDate = new Date(campaign.start_date);
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + newPost.day - 1);
      const [hours, minutes] = newPost.time.split(":").map(Number);
      scheduledDate.setHours(hours, minutes, 0, 0);

      const { error } = await (supabase as any).from("campaign_posts").insert({
        campaign_id: id,
        day: newPost.day,
        time: newPost.time,
        type: newPost.type,
        category: newPost.category,
        text: newPost.text,
        scheduled_at: scheduledDate.toISOString(),
        status: "scheduled",
        platforms: campaign.target_platforms || ["x"],
        custom_image_url: mediaUrl,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-posts", id] });
      toast.success("Post został dodany");
      setIsAddingPost(false);
      clearNewPostMedia();
      setNewPost({
        day: 1,
        time: "09:00",
        type: "content",
        category: "trivia",
        text: "",
      });
      setIsUploadingMedia(false);
    },
    onError: () => {
      toast.error("Błąd podczas dodawania posta");
      setIsUploadingMedia(false);
    },
  });

  const updatePostMediaMutation = useMutation({
    mutationFn: async ({ postId, mediaUrl }: { postId: string; mediaUrl: string | null }) => {
      const { error } = await (supabase as any)
        .from("campaign_posts")
        .update({ custom_image_url: mediaUrl } as any)
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-posts", id] });
      toast.success("Media posta zostały zaktualizowane");
    },
    onError: () => {
      toast.error("Błąd podczas aktualizacji mediów");
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ postId, scheduledAt }: { postId: string; scheduledAt: string }) => {
      const { error } = await (supabase as any)
        .from("campaign_posts")
        .update({ scheduled_at: scheduledAt } as any)
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-posts", id] });
      toast.success("Godzina publikacji zaktualizowana");
    },
    onError: () => {
      toast.error("Błąd podczas aktualizacji godziny publikacji");
    },
  });

  const retryPostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const scheduledAt = new Date();
      scheduledAt.setMinutes(scheduledAt.getMinutes() + 2);

      // Keep error information but update schedule and status
      const { error } = await (supabase as any)
        .from("campaign_posts")
        .update({
          status: "scheduled",
          scheduled_at: scheduledAt.toISOString(),
          published_at: null,
          next_retry_at: null, // Clear automatic retry time since user is manually retrying
        } as any)
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-posts", id] });
      toast.success("Post zostanie ponownie wysłany za 2 minuty");
    },
    onError: () => {
      toast.error("Błąd podczas ponownej próby publikacji");
    },
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: async () => {
      // Update campaign status to paused
      const { error: campaignError } = await (supabase as any)
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", id);

      if (campaignError) throw campaignError;

      // Also pause all scheduled posts in this campaign
      const { error: postsError } = await (supabase as any)
        .from("campaign_posts")
        .update({ status: "paused" })
        .eq("campaign_id", id)
        .eq("status", "scheduled");

      if (postsError) throw postsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-posts", id] });
      toast.success("Kampania została zatrzymana. Posty nie będą publikowane.");
    },
    onError: () => {
      toast.error("Błąd podczas zatrzymywania kampanii");
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

  const publishedCount = posts.filter((p) => p.status === "published").length;
  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
  const failedCount = posts.filter((p) => p.status === "failed").length;
  const pausedCount = posts.filter((p) => p.status === "paused").length;
  const progress = posts.length > 0 ? (publishedCount / posts.length) * 100 : 0;

  // Group posts by day
  const postsByDay = (posts as any[]).reduce(
    (acc: Record<number, any[]>, post: any) => {
      const day = post.day as number;
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(post);
      return acc;
    },
    {} as Record<number, any[]>,
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Szkic
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="outline" className="gap-1">
            <Calendar className="h-3 w-3" /> Zaplanowana
          </Badge>
        );
      case "active":
        return (
          <Badge className="gap-1 bg-gradient-primary">
            <TrendingUp className="h-3 w-3" /> Aktywna
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3" /> Zakończona
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary" className="gap-1 bg-red-500/10 text-red-600 border-red-500/20">
            <AlertCircle className="h-3 w-3" /> Anulowana
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Pause className="h-3 w-3" /> Zatrzymana
          </Badge>
        );
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
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-primary-foreground">{campaign.name}</h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary-foreground hover:bg-white/10"
                    onClick={() => {
                      setEditedName(campaign.name);
                      setIsEditNameDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-primary-foreground/90 mt-1">
                  {campaign.description || "Szczegóły kampanii"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {campaign.status !== "paused" && campaign.status !== "completed" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2" title="Zatrzymaj publikowanie postów w tej kampanii">
                      <Pause className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Czy na pewno chcesz zatrzymać tę kampanię?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Wszystkie zaplanowane posty zostaną wstrzymane i nie będą automatycznie publikowane. Możesz
                        wznowić kampanię w każdej chwili.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anuluj</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => pauseCampaignMutation.mutate()}
                        className="bg-yellow-600 text-white hover:bg-yellow-700"
                      >
                        Zatrzymaj
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="secondary" className="gap-2" title="Opublikuj wszystkie posty w tej kampanii od nowa" onClick={() => setIsResumeDialogOpen(true)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="secondary" className="gap-2" title="Utwórz kolejną kampanię z takimi samymi ustawieniami" onClick={() => setIsCopyDialogOpen(true)}>
                <Copy className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2" title="Usuń tę kampanię">
                    <Trash2 className="h-4 w-4" />
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
                  { locale: pl },
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
              {pausedCount > 0 && (
                <div className="flex items-center gap-2">
                  <Pause className="h-4 w-4 text-yellow-600" />
                  <span>{pausedCount} wstrzymanych</span>
                </div>
              )}
            </div>
          </div>

          {/* Selected Accounts Section */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Konta do publikacji</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {campaign.selected_accounts && Object.keys(campaign.selected_accounts).length > 0 ? (
                // Show only accounts that:
                // 1. Exist in accountsMap (verified to exist in DB)
                // 2. Their platform is in target_platforms (if target_platforms exists)
                Object.entries(campaign.selected_accounts as Record<string, string[]>)
                  .filter(([platform]) => {
                    // Only show platforms that are actually selected for this campaign
                    const targetPlatforms = campaign.target_platforms as string[] | null;
                    return !targetPlatforms || targetPlatforms.length === 0 || targetPlatforms.includes(platform);
                  })
                  .flatMap(([platform, accountIds]) => {
                    const platformConfig = getPlatformConfig(platform as PlatformId);
                    const Icon = platformConfig?.icon;
                    return (accountIds as string[])
                      .filter((accountId) => accountsMap[accountId]) // Only show accounts that exist
                      .map((accountId) => {
                        const accountInfo = accountsMap[accountId];
                        return (
                          <Badge key={accountId} variant="secondary" className="gap-2 py-1.5 px-3">
                            {Icon && <Icon className="h-3.5 w-3.5" />}
                            <span>{accountInfo.display_name}</span>
                          </Badge>
                        );
                      });
                  })
              ) : (
                // Fallback for older campaigns - show target platforms only if they exist
                (campaign.target_platforms as string[] || []).length > 0 ? (
                  (campaign.target_platforms as string[]).map((platform: string) => {
                    const platformConfig = getPlatformConfig(platform as PlatformId);
                    const Icon = platformConfig?.icon;
                    return (
                      <Badge key={platform} variant="secondary" className="gap-2 py-1.5 px-3">
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                        <span>{platformConfig?.name || platform} (domyślne konto)</span>
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">Brak wybranych platform</span>
                )
              )}
              {/* Show message if no accounts found */}
              {campaign.selected_accounts && 
                Object.keys(campaign.selected_accounts).length > 0 && 
                Object.keys(accountsMap).length === 0 && (
                  <span className="text-sm text-muted-foreground">Ładowanie kont...</span>
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
                  <DialogDescription>Stwórz nowy post i dodaj go do harmonogramu kampanii</DialogDescription>
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
                      rows={6}
                      value={newPost.text}
                      onChange={(e) => setNewPost({ ...newPost, text: e.target.value })}
                      placeholder="Wpisz treść posta..."
                    />
                  </div>
                  
                  {/* Media upload section */}
                  <div className="space-y-2">
                    <Label>Media (opcjonalne)</Label>
                    {newPostMediaPreview ? (
                      <div className="relative inline-block">
                        {newPostMediaFile?.type.startsWith('video/') ? (
                          <div className="relative">
                            <video
                              src={newPostMediaPreview}
                              className="max-h-32 rounded-lg border"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                              <Video className="h-8 w-8 text-white" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={newPostMediaPreview}
                            alt="Podgląd"
                            className="max-h-32 rounded-lg border object-cover"
                          />
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={clearNewPostMedia}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg hover:bg-muted/50 transition-colors">
                          <ImageIcon className="h-4 w-4" />
                          <span className="text-sm">Dodaj grafikę</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleNewPostMediaChange}
                          />
                        </Label>
                        <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg hover:bg-muted/50 transition-colors">
                          <Video className="h-4 w-4" />
                          <span className="text-sm">Dodaj wideo</span>
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={handleNewPostMediaChange}
                          />
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingPost(false)}>
                    Anuluj
                  </Button>
                  <Button
                    onClick={() => addPostMutation.mutate()}
                    disabled={!newPost.text.trim() || addPostMutation.isPending || isUploadingMedia}
                  >
                    {isUploadingMedia ? "Przesyłanie..." : addPostMutation.isPending ? "Dodawanie..." : "Dodaj post"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {Object.entries(postsByDay as Record<string, any[]>).map(([day, dayPosts]) => {
            // Use actual scheduled_at from first post for accurate day title
            const firstPost = (dayPosts as any[])[0];
            const dayDate = firstPost?.scheduled_at 
              ? new Date(firstPost.scheduled_at)
              : (() => { const d = new Date(campaign.start_date); d.setDate(d.getDate() + parseInt(day) - 1); return d; })();

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
                      userId={user?.id}
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
                      onRetry={async (postId) => {
                        await retryPostMutation.mutateAsync(postId);
                      }}
                      onUpdateMedia={async (postId, mediaUrl) => {
                        await updatePostMediaMutation.mutateAsync({ postId, mediaUrl });
                      }}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Resume Campaign Dialog */}
      {campaign && posts && (
        <ResumeCampaignDialog
          open={isResumeDialogOpen}
          onOpenChange={setIsResumeDialogOpen}
          campaign={{
            id: campaign.id,
            name: campaign.name,
            duration_days: campaign.duration_days,
            posts_per_day: campaign.posts_per_day,
            start_date: campaign.start_date,
            posting_times: campaign.posting_times || [],
            target_platforms: campaign.target_platforms || ["x"],
            selected_accounts: campaign.selected_accounts as Record<string, string[]> || {},
          }}
          posts={posts.map((p: any) => ({
            id: p.id,
            day: p.day,
            time: p.time,
            type: p.type,
            category: p.category,
            text: p.text,
            book_id: p.book_id,
            platforms: p.platforms || campaign.target_platforms || ["x"],
            target_accounts: p.target_accounts as Record<string, string[]> || {},
            custom_image_url: p.custom_image_url || null,
          }))}
        />
      )}

      {/* Edit Campaign Name Dialog */}
      <Dialog open={isEditNameDialogOpen} onOpenChange={setIsEditNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj nazwę kampanii</DialogTitle>
            <DialogDescription>Wprowadź nową nazwę dla tej kampanii.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="campaign-name">Nazwa kampanii</Label>
            <Input
              id="campaign-name"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder="Nazwa kampanii"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditNameDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={() => updateCampaignNameMutation.mutate(editedName)}
              disabled={!editedName.trim() || updateCampaignNameMutation.isPending}
            >
              {updateCampaignNameMutation.isPending ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CopyCampaignDialog
        open={isCopyDialogOpen}
        onOpenChange={setIsCopyDialogOpen}
        campaign={{
          id: campaign.id,
          name: campaign.name,
          duration_days: campaign.duration_days,
          posts_per_day: campaign.posts_per_day,
          start_date: campaign.start_date,
          posting_times: Array.isArray(campaign.posting_times) ? campaign.posting_times : [],
          target_platforms: Array.isArray(campaign.target_platforms) ? campaign.target_platforms : [],
          content_posts_count: campaign.content_posts_count,
          sales_posts_count: campaign.sales_posts_count,
        }}
        selectedBooks={Array.from(new Set(posts.filter((p: any) => p.book_id).map((p: any) => String(p.book_id))))}
      />
    </div>
  );
};

export default CampaignDetails;
