import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Clock, Image, Loader2, ArrowRight, Calendar, Upload } from "lucide-react";
import { format, addDays } from "date-fns";
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
  imageUrl?: string;
  imageFile?: File;
}

export const SimpleCampaignSetup = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SimplePost[]>([
    { id: crypto.randomUUID(), text: "", time: "10:00" },
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

    const { data: xData } = await (supabase as any).from("twitter_oauth_tokens").select("id").limit(1).maybeSingle();
    const { data: fbData } = await (supabase as any).from("facebook_oauth_tokens").select("id").limit(1).maybeSingle();
    const { data: tiktokData } = await (supabase as any).from("tiktok_oauth_tokens").select("id").limit(1).maybeSingle();

    platforms.forEach((platform) => {
      if (platform.id === "x") connectionStatus[platform.id] = !!xData;
      else if (platform.id === "facebook") connectionStatus[platform.id] = !!fbData;
      else if (platform.id === "tiktok") connectionStatus[platform.id] = !!tiktokData;
      else connectionStatus[platform.id] = false;
    });

    setConnectedPlatforms(connectionStatus as Record<PlatformId, boolean>);
  };

  const addPost = () => {
    const lastTime = posts[posts.length - 1]?.time || "10:00";
    const [hours] = lastTime.split(":").map(Number);
    const newHour = (hours + 2) % 24;
    
    setPosts([
      ...posts,
      { id: crypto.randomUUID(), text: "", time: `${newHour.toString().padStart(2, "0")}:00` },
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
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    updatePost(postId, { imageUrl: previewUrl, imageFile: file });
  };

  const handleCreateCampaign = async () => {
    // Validate
    const emptyPosts = posts.filter((p) => !p.text.trim());
    if (emptyPosts.length > 0) {
      toast.error("Wypełnij treść wszystkich postów");
      return;
    }

    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nie zalogowany");

      // Upload images if any
      const postsWithUploadedImages: SimplePost[] = [];
      for (const post of posts) {
        let uploadedImageUrl = post.imageUrl;
        
        if (post.imageFile) {
          const fileName = `${user.id}/${Date.now()}_${post.imageFile.name}`;
          const { error: uploadError } = await supabase.storage
            .from("ObrazkiKsiazek")
            .upload(fileName, post.imageFile);

          if (uploadError) {
            console.error("Upload error:", uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from("ObrazkiKsiazek")
              .getPublicUrl(fileName);
            uploadedImageUrl = publicUrl;
          }
        }
        
        postsWithUploadedImages.push({ ...post, imageUrl: uploadedImageUrl });
      }

      // Create campaign
      const campaignName = `Prosta kampania ${format(new Date(startDate), "dd.MM.yyyy")}`;
      const sortedTimes = [...posts].sort((a, b) => {
        const [aH, aM] = a.time.split(":").map(Number);
        const [bH, bM] = b.time.split(":").map(Number);
        return aH * 60 + aM - (bH * 60 + bM);
      });

      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          name: campaignName,
          user_id: user.id,
          duration_days: 1,
          posts_per_day: posts.length,
          start_date: new Date(startDate).toISOString(),
          posting_times: sortedTimes.map((p) => p.time),
          target_platforms: targetPlatforms,
          selected_accounts: selectedAccounts,
          content_posts_count: 0,
          sales_posts_count: posts.length,
          status: "active",
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create posts
      const campaignPosts = postsWithUploadedImages.map((post, index) => {
        const [hours, minutes] = post.time.split(":").map(Number);
        const scheduledAt = new Date(startDate);
        scheduledAt.setHours(hours, minutes, 0, 0);

        return {
          campaign_id: campaign.id,
          day: 1,
          time: post.time,
          type: "sales",
          category: "Promocja",
          text: post.text,
          scheduled_at: scheduledAt.toISOString(),
          status: "scheduled",
          platforms: targetPlatforms,
          target_accounts: selectedAccounts,
          custom_image_url: post.imageUrl || null,
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

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-secondary/30">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Kiedy opublikować?
        </h3>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="max-w-xs"
        />
      </Card>

      <Card className="p-6 bg-secondary/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Twoje posty</h3>
          <Button variant="outline" size="sm" onClick={addPost} className="gap-2">
            <Plus className="h-4 w-4" />
            Dodaj post
          </Button>
        </div>

        <div className="space-y-4">
          {posts.map((post, index) => (
            <div key={post.id} className="p-4 border rounded-lg bg-background space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Post #{index + 1}</span>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={post.time}
                    onChange={(e) => updatePost(post.id, { time: e.target.value })}
                    className="w-28"
                  />
                  {posts.length > 1 && (
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

              <div className="flex items-center gap-3">
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
                      onClick={() => updatePost(post.id, { imageUrl: undefined, imageFile: undefined })}
                      className="h-6 w-6 p-0 text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

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
          <strong>{posts.length}</strong> post{posts.length === 1 ? "" : "ów"} zaplanowanych na{" "}
          <strong>{format(new Date(startDate), "d MMMM yyyy")}</strong>
        </p>
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
