import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Clock, Image, Loader2, ArrowRight, Calendar, Video, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { pl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { PlatformSelector } from "./PlatformSelector";
import { AccountSelector } from "./AccountSelector";
import { PlatformId, getAllPlatforms } from "@/config/platforms";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface SimplePost {
  id: string;
  text: string;
  time: string;
  day: number;
  imageUrl?: string;
  imageFile?: File;
  videoUrl?: string;
  videoFile?: File;
}

export const SimpleCampaignSetup = () => {
  const navigate = useNavigate();
  const [durationDays, setDurationDays] = useState(1);
  const [posts, setPosts] = useState<SimplePost[]>([
    { id: crypto.randomUUID(), text: "", time: "10:00", day: 1 },
  ]);
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [targetPlatforms, setTargetPlatforms] = useState<PlatformId[]>(["x"]);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<PlatformId, string[]>>({} as Record<PlatformId, string[]>);
  const [connectedPlatforms, setConnectedPlatforms] = useState<Record<PlatformId, boolean>>({} as Record<PlatformId, boolean>);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    checkConnectedPlatforms();
  }, []);

  const checkConnectedPlatforms = async () => {
    const platforms = getAllPlatforms();
    const connectionStatus: Record<string, boolean> = {};

    // Map platform IDs to their token table names
    const platformTableMap: Record<string, string> = {
      x: "twitter_oauth1_tokens",
      facebook: "facebook_oauth_tokens",
      tiktok: "tiktok_oauth_tokens",
      youtube: "youtube_oauth_tokens",
      instagram: "instagram_oauth_tokens",
      linkedin: "linkedin_oauth_tokens",
      telegram: "telegram_tokens",
      bluesky: "bluesky_tokens",
      discord: "discord_tokens",
      threads: "threads_oauth_tokens",
      pinterest: "pinterest_oauth_tokens",
      reddit: "reddit_oauth_tokens",
      mastodon: "mastodon_tokens",
      tumblr: "tumblr_oauth_tokens",
      snapchat: "snapchat_oauth_tokens",
      google_business: "google_business_tokens",
    };

    // Check all platform connections in parallel
    const results = await Promise.all(
      platforms.map(async (platform) => {
        const table = platformTableMap[platform.id];
        if (!table) return { id: platform.id, connected: false };
        const { data } = await (supabase as any).from(table).select("id").limit(1).maybeSingle();
        return { id: platform.id, connected: !!data };
      })
    );

    results.forEach((r) => {
      connectionStatus[r.id] = r.connected;
    });

    setConnectedPlatforms(connectionStatus as Record<PlatformId, boolean>);
  };

  const addPost = (day: number) => {
    const postsForDay = posts.filter(p => p.day === day);
    const lastTime = postsForDay[postsForDay.length - 1]?.time || "10:00";
    const [hours] = lastTime.split(":").map(Number);
    const newHour = (hours + 2) % 24;
    
    setPosts([
      ...posts,
      { id: crypto.randomUUID(), text: "", time: `${newHour.toString().padStart(2, "0")}:00`, day },
    ]);
  };

  const removePost = (id: string) => {
    if (posts.length > 1) {
      setPosts(posts.filter((p) => p.id !== id));
    }
  };

  const updatePost = (id: string, updates: Partial<SimplePost>) => {
    setPosts(posts.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleImageUpload = async (postId: string, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    updatePost(postId, { imageUrl: previewUrl, imageFile: file, videoUrl: undefined, videoFile: undefined });
  };

  const handleVideoUpload = async (postId: string, file: File) => {
    // Validate file size (128MB max)
    if (file.size > 128 * 1024 * 1024) {
      toast.error("Plik wideo jest za duży (max 128MB)");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    updatePost(postId, { videoUrl: previewUrl, videoFile: file, imageUrl: undefined, imageFile: undefined });
  };

  const clearMedia = (postId: string) => {
    updatePost(postId, { imageUrl: undefined, imageFile: undefined, videoUrl: undefined, videoFile: undefined });
  };

  const addDay = () => {
    const newDay = durationDays + 1;
    setDurationDays(newDay);
    // Add a default post for the new day
    const defaultTime = "10:00";
    setPosts([
      ...posts,
      { id: crypto.randomUUID(), text: "", time: defaultTime, day: newDay },
    ]);
  };

  const removeDay = (dayToRemove: number) => {
    if (durationDays <= 1) return;
    
    // Remove all posts for this day
    const updatedPosts = posts.filter(p => p.day !== dayToRemove);
    
    // Renumber days for posts after the removed day
    const renumberedPosts = updatedPosts.map(p => ({
      ...p,
      day: p.day > dayToRemove ? p.day - 1 : p.day
    }));
    
    setPosts(renumberedPosts);
    setDurationDays(durationDays - 1);
  };

  const handleCreateCampaign = async () => {
    const emptyPosts = posts.filter((p) => !p.text.trim());
    if (emptyPosts.length > 0) {
      toast.error("Wypełnij treść wszystkich postów");
      return;
    }

    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nie zalogowany");

      // Upload images and videos
      const postsWithUploadedMedia: SimplePost[] = [];
      for (const post of posts) {
        // Initialize as undefined - only set to public URL after successful upload
        let uploadedImageUrl: string | undefined = undefined;
        let uploadedVideoUrl: string | undefined = undefined;
        
        // Upload image if present
        if (post.imageFile) {
          const fileName = `${user.id}/${Date.now()}_${post.imageFile.name}`;
          const { error: uploadError } = await supabase.storage
            .from("ObrazkiKsiazek")
            .upload(fileName, post.imageFile);

          if (uploadError) {
            console.error("Image upload error:", uploadError);
            toast.error(`Błąd uploadu grafiki dla posta: ${uploadError.message}`);
            // uploadedImageUrl remains undefined - never store blob URL
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from("ObrazkiKsiazek")
              .getPublicUrl(fileName);
            uploadedImageUrl = publicUrl;
          }
        }
        
        // Upload video if present - sanitize filename
        if (post.videoFile) {
          // Sanitize filename: remove Polish chars, spaces, and special chars
          const sanitizeFileName = (name: string): string => {
            return name
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c: string) => {
                const map: Record<string, string> = {
                  'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
                  'Ą':'A','Ć':'C','Ę':'E','Ł':'L','Ń':'N','Ó':'O','Ś':'S','Ź':'Z','Ż':'Z'
                };
                return map[c] || c;
              })
              .replace(/\s+/g, '_')
              .replace(/[^a-zA-Z0-9._-]/g, '');
          };
          
          const sanitizedName = sanitizeFileName(post.videoFile.name);
          const fileName = `${user.id}/videos/${Date.now()}_${sanitizedName}`;
          const { error: uploadError } = await supabase.storage
            .from("ObrazkiKsiazek")
            .upload(fileName, post.videoFile);

          if (uploadError) {
            console.error("Video upload error:", uploadError);
            toast.error(`Błąd uploadu wideo dla posta: ${uploadError.message}`);
            // uploadedVideoUrl remains undefined - never store blob URL
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from("ObrazkiKsiazek")
              .getPublicUrl(fileName);
            uploadedVideoUrl = publicUrl;
          }
        }
        
        postsWithUploadedMedia.push({ 
          ...post, 
          imageUrl: uploadedImageUrl,  // Always public URL or undefined, never blob URL
          videoUrl: uploadedVideoUrl   // Always public URL or undefined, never blob URL
        });
      }

      // Create campaign
      const campaignName = `Prosta kampania ${format(new Date(startDate), "dd.MM.yyyy")}`;
      const allTimes = [...new Set(posts.map(p => p.time))].sort();

      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          name: campaignName,
          user_id: user.id,
          duration_days: durationDays,
          posts_per_day: Math.ceil(posts.length / durationDays),
          start_date: new Date(startDate).toISOString(),
          posting_times: allTimes,
          target_platforms: targetPlatforms,
          selected_accounts: selectedAccounts,
          content_posts_count: 0,
          sales_posts_count: posts.length,
          status: "active",
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create posts with proper scheduled dates based on day
      const campaignPosts = postsWithUploadedMedia.map((post) => {
        const [hours, minutes] = post.time.split(":").map(Number);
        const scheduledAt = addDays(new Date(startDate), post.day - 1);
        scheduledAt.setHours(hours, minutes, 0, 0);

        return {
          campaign_id: campaign.id,
          day: post.day,
          time: post.time,
          type: "sales",
          category: "Promocja",
          text: post.text,
          scheduled_at: scheduledAt.toISOString(),
          status: "scheduled",
          platforms: targetPlatforms,
          target_accounts: selectedAccounts,
          custom_image_url: post.imageUrl || post.videoUrl || null,
        };
      });

      const { error: postsError } = await supabase.from("campaign_posts").insert(campaignPosts);
      if (postsError) throw postsError;

      toast.success("Kampania utworzona i zaplanowana!");
      navigate(`/campaigns/${campaign.id}`);
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast.error("Błąd tworzenia kampanii: " + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const canSubmit = posts.every((p) => p.text.trim()) && targetPlatforms.length > 0;

  // Group posts by day
  const postsByDay: Record<number, SimplePost[]> = {};
  for (let day = 1; day <= durationDays; day++) {
    postsByDay[day] = posts.filter(p => p.day === day);
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-secondary/30">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Kiedy rozpocząć kampanię?
        </h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Data startu</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Liczba dni</Label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{durationDays}</span>
              <Button variant="outline" size="sm" onClick={addDay} className="gap-1">
                <Plus className="h-3 w-3" />
                Dodaj dzień
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Posts grouped by day */}
      {Array.from({ length: durationDays }, (_, i) => i + 1).map((day) => {
        const dayPosts = postsByDay[day] || [];
        const dayDate = addDays(new Date(startDate), day - 1);
        
        return (
          <Card key={day} className="p-6 bg-secondary/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  Dzień {day} - {format(dayDate, "EEEE, d MMMM", { locale: pl })}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {dayPosts.length} post{dayPosts.length === 1 ? "" : dayPosts.length < 5 ? "y" : "ów"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => addPost(day)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Dodaj post
                </Button>
                {durationDays > 1 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeDay(day)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {dayPosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Brak postów na ten dzień.{" "}
                  <button 
                    onClick={() => addPost(day)} 
                    className="text-primary underline hover:no-underline"
                  >
                    Dodaj pierwszy post
                  </button>
                </div>
              ) : (
                dayPosts.map((post, index) => (
                  <div key={post.id} className="p-4 border rounded-lg bg-background space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Post #{index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          value={post.time}
                          onChange={(e) => updatePost(post.id, { time: e.target.value })}
                          className="w-28"
                        />
                        {dayPosts.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removePost(post.id)}
                            className="h-8 w-8 p-0 text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <Textarea
                      placeholder="Wklej lub napisz treść posta..."
                      value={post.text}
                      onChange={(e) => updatePost(post.id, { text: e.target.value })}
                      rows={4}
                    />

                    {/* Media upload section */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Image upload */}
                      <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg hover:bg-muted/50 transition-colors">
                        <Image className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {post.imageUrl ? "Zmień grafikę" : "Dodaj grafikę"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(post.id, file);
                          }}
                        />
                      </Label>

                      {/* Video upload */}
                      <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg hover:bg-muted/50 transition-colors">
                        <Video className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {post.videoUrl ? "Zmień wideo" : "Dodaj wideo"}
                        </span>
                        <input
                          type="file"
                          accept="video/mp4,video/mov,video/webm"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoUpload(post.id, file);
                          }}
                        />
                      </Label>

                      {/* Image preview */}
                      {post.imageUrl && (
                        <div className="flex items-center gap-2">
                          <img
                            src={post.imageUrl}
                            alt="Podgląd"
                            className="h-10 w-10 object-cover rounded"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearMedia(post.id)}
                            className="h-6 w-6 p-0 text-muted-foreground"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Video preview */}
                      {post.videoUrl && (
                        <div className="flex items-center gap-2">
                          <video
                            src={post.videoUrl}
                            className="h-10 w-16 object-cover rounded"
                          />
                          <span className="text-xs text-muted-foreground">Wideo</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearMedia(post.id)}
                            className="h-6 w-6 p-0 text-muted-foreground"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        );
      })}

      <PlatformSelector
        selected={targetPlatforms}
        onChange={setTargetPlatforms}
        connectedPlatforms={connectedPlatforms}
      />

      <AccountSelector
        selectedPlatforms={targetPlatforms}
        selectedAccounts={selectedAccounts}
        onChange={setSelectedAccounts}
      />

      <Card className="p-6 bg-gradient-subtle border-primary/20">
        <h3 className="text-lg font-semibold mb-2">Podsumowanie</h3>
        <p className="text-muted-foreground">
          <strong>{posts.length}</strong> post{posts.length === 1 ? "" : posts.length < 5 ? "y" : "ów"} zaplanowanych na{" "}
          <strong>{durationDays}</strong> dni{durationDays === 1 ? "" : durationDays < 5 ? "" : ""}, 
          rozpoczynając od <strong>{format(new Date(startDate), "d MMMM yyyy", { locale: pl })}</strong>
        </p>
        {posts.some(p => p.imageFile || p.videoFile) && (
          <p className="text-sm text-muted-foreground mt-1">
            📎 {posts.filter(p => p.imageFile).length} grafik, {posts.filter(p => p.videoFile).length} wideo do przesłania
          </p>
        )}
      </Card>

      <Button
        onClick={handleCreateCampaign}
        className="w-full"
        size="lg"
        disabled={!canSubmit || isCreating}
      >
        {isCreating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Tworzenie kampanii...
          </>
        ) : (
          <>
            Utwórz i zaplanuj kampanię
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
};
