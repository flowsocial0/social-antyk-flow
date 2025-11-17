import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Zap, Loader2, CheckCircle2, Calendar, Target } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { pl } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;

export default function ExpressCampaignLaunch() {
  const [searchParams] = useSearchParams();
  const campaignIds = searchParams.get('campaigns')?.split(',') || [];
  const navigate = useNavigate();
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [progress, setProgress] = useState<string>("");

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .in('id', campaignIds);

      if (error) throw error;
      setCampaigns(data as Campaign[] || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast.error('Błąd wczytywania kampanii');
    } finally {
      setLoading(false);
    }
  };

  const launchAllCampaigns = async () => {
    setLaunching(true);
    setProgress("Rozpoczynanie automatycznej kampanii...");

    try {
      for (const campaign of campaigns) {
        const platforms = Array.isArray(campaign.target_platforms) 
          ? campaign.target_platforms 
          : JSON.parse(campaign.target_platforms as string);
        const postingTimes = Array.isArray(campaign.posting_times)
          ? campaign.posting_times
          : JSON.parse(campaign.posting_times as string);
        const platform = platforms[0];
        setProgress(`Generowanie struktury kampanii dla ${platform.toUpperCase()}...`);

        // Step 1: Generate campaign structure
        const { data: structureData, error: structureError } = await supabase.functions.invoke('generate-campaign', {
          body: {
            action: 'generateStructure',
            totalPosts: campaign.content_posts_count + campaign.sales_posts_count,
            contentPosts: campaign.content_posts_count,
            salesPosts: campaign.sales_posts_count,
            durationDays: campaign.duration_days,
            postsPerDay: campaign.posts_per_day
          }
        });

        if (structureError) throw structureError;

        setProgress(`Generowanie treści postów dla ${platform.toUpperCase()}...`);

        // Step 2: Generate posts content
        const { data: postsData, error: postsError } = await supabase.functions.invoke('generate-campaign', {
          body: {
            action: 'generatePosts',
            structure: structureData.structure,
            platforms: platforms
          }
        });

        if (postsError) throw postsError;

        setProgress(`Planowanie ${postsData.posts.length} postów dla ${platform.toUpperCase()}...`);

        // Step 3: Schedule all posts
        const startDate = new Date(campaign.start_date);
        let currentDay = 0;
        let postIndexInDay = 0;

        for (const post of postsData.posts) {
          const postTime = postingTimes[postIndexInDay];
          const [hours, minutes] = postTime.split(':').map(Number);
          
          const scheduledDate = addDays(startDate, currentDay);
          scheduledDate.setHours(hours, minutes, 0, 0);

          const { error: insertError } = await supabase
            .from('campaign_posts')
            .insert({
              campaign_id: campaign.id,
              day: currentDay + 1,
              time: postTime,
              type: post.type,
              category: post.category,
              text: post.text,
              book_id: post.bookId || null,
              scheduled_at: scheduledDate.toISOString(),
              platforms: platforms,
              status: 'scheduled'
            });

          if (insertError) throw insertError;

          // Update book campaign counter if this is a sales post
          if (post.bookId) {
            const { data: book } = await supabase
              .from('books')
              .select('campaign_post_count')
              .eq('id', post.bookId)
              .single();

            await supabase
              .from('books')
              .update({ 
                campaign_post_count: (book?.campaign_post_count || 0) + 1,
                last_campaign_date: new Date().toISOString() 
              })
              .eq('id', post.bookId);
          }

          postIndexInDay++;
          if (postIndexInDay >= postingTimes.length) {
            postIndexInDay = 0;
            currentDay++;
          }
        }

        // Step 4: Update campaign status to active
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({ status: 'active' })
          .eq('id', campaign.id);

        if (updateError) throw updateError;

        setProgress(`✅ Kampania ${platform.toUpperCase()} uruchomiona!`);
      }

      toast.success("Wszystkie kampanie zostały uruchomione!", {
        description: "Posty będą publikowane automatycznie zgodnie z harmonogramem"
      });

      setTimeout(() => {
        navigate('/campaigns');
      }, 2000);

    } catch (error) {
      console.error('Error launching campaigns:', error);
      toast.error('Błąd uruchamiania kampanii', {
        description: error instanceof Error ? error.message : 'Nieznany błąd'
      });
      setLaunching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-gradient-primary shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-primary-foreground hover:bg-white/10"
              disabled={launching}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Powrót
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-primary-foreground flex items-center gap-2">
                <Zap className="h-8 w-8" />
                Kampania Express - Automatyczne Uruchomienie
              </h1>
              <p className="text-sm text-primary-foreground/90 mt-1">
                Jeden przycisk automatycznie generuje treści, planuje i uruchamia wszystko
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Summary Card */}
          <Card className="p-8 bg-gradient-card border-border/50 shadow-card">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Podsumowanie Kampanii
            </h2>
            
            <div className="space-y-6">
              {campaigns.map((campaign) => {
                const platforms = Array.isArray(campaign.target_platforms) 
                  ? campaign.target_platforms 
                  : JSON.parse(campaign.target_platforms as string);
                const platform = platforms[0];
                const totalPosts = campaign.content_posts_count + campaign.sales_posts_count;
                
                return (
                  <Card key={campaign.id} className="p-6 bg-background/50 border-border/30">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold mb-1 capitalize">
                          Platforma: {platform === 'x' ? 'X (Twitter)' : platform}
                        </h3>
                        <p className="text-sm text-muted-foreground">{campaign.description}</p>
                      </div>
                      {launching && (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Czas trwania</p>
                        <p className="text-2xl font-bold text-primary">{campaign.duration_days} dni</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Postów dziennie</p>
                        <p className="text-2xl font-bold text-primary">{campaign.posts_per_day}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Łącznie postów</p>
                        <p className="text-2xl font-bold text-primary">{totalPosts}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Proporcja</p>
                        <p className="text-lg font-semibold text-primary">
                          {Math.round((campaign.content_posts_count / totalPosts) * 100)}% / {Math.round((campaign.sales_posts_count / totalPosts) * 100)}%
                        </p>
                        <p className="text-xs text-muted-foreground">content/sprzedaż</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/30">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Start:</span>
                        <span className="font-medium">
                          {format(new Date(campaign.start_date), "d MMMM yyyy, HH:mm", { locale: pl })}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>

          {/* Launch Button */}
          {!launching ? (
            <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-2">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">Gotowe do uruchomienia!</h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Kliknij poniższy przycisk, aby automatycznie:
                </p>
                <ul className="text-left inline-block space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Wygenerować {campaigns.reduce((sum, c) => sum + c.content_posts_count + c.sales_posts_count, 0)} unikalnych treści postów przez AI
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Zaplanować wszystkie posty z dokładnymi godzinami publikacji
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Uruchomić kampanie na wszystkich połączonych platformach
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Automatycznie publikować posty zgodnie z harmonogramem
                  </li>
                </ul>
                <Button
                  size="lg"
                  onClick={launchAllCampaigns}
                  className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Uruchom Wszystko Automatycznie
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-8 bg-gradient-card border-border/50 shadow-card">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <h3 className="text-xl font-semibold">Uruchamianie kampanii...</h3>
                <p className="text-muted-foreground">{progress}</p>
                <div className="max-w-md mx-auto">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
