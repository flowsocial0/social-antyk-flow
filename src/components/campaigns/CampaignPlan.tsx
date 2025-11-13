import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowLeft, ArrowRight, BookOpen, TrendingUp } from "lucide-react";
import { format, addDays, parse } from "date-fns";
import { pl } from "date-fns/locale";
import type { CampaignConfig, CampaignPost } from "./CampaignBuilder";

interface CampaignPlanProps {
  config: CampaignConfig;
  onComplete: (plan: { structure: any[] }, posts: CampaignPost[]) => void;
  onBack: () => void;
}

export const CampaignPlan = ({ config, onComplete, onBack }: CampaignPlanProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<any>(null);

  const totalPosts = config.durationDays * config.postsPerDay;
  const contentPosts = Math.floor(totalPosts * 0.8);
  const salesPosts = totalPosts - contentPosts;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Step 1: Generate campaign structure
      console.log("Generating campaign structure...");
      const structureResponse = await supabase.functions.invoke('generate-campaign', {
        body: {
          action: 'generate_structure',
          totalPosts,
          contentPosts,
          salesPosts,
          durationDays: config.durationDays,
          postsPerDay: config.postsPerDay
        }
      });

      if (structureResponse.error) throw structureResponse.error;

      const structure = structureResponse.data.structure;
      console.log("Structure generated:", structure);

      // Step 2: Generate content for each post
      console.log("Generating post content...");
      const contentResponse = await supabase.functions.invoke('generate-campaign', {
        body: {
          action: 'generate_posts',
          structure
        }
      });

      if (contentResponse.error) throw contentResponse.error;

      const generatedPosts = contentResponse.data.posts;
      console.log("Posts generated:", generatedPosts.length);

      // Step 3: Schedule posts
      const scheduledPosts: CampaignPost[] = [];
      const startDate = parse(config.startDate, 'yyyy-MM-dd', new Date());

      generatedPosts.forEach((post: any, index: number) => {
        const dayIndex = Math.floor(index / config.postsPerDay);
        const timeIndex = index % config.postsPerDay;
        const postDate = addDays(startDate, dayIndex);
        
        const [hours, minutes] = config.postingTimes[timeIndex].split(':').map(Number);
        postDate.setHours(hours, minutes, 0, 0);

        scheduledPosts.push({
          day: dayIndex + 1,
          time: config.postingTimes[timeIndex],
          type: post.type,
          category: post.category,
          text: post.text,
          scheduledAt: postDate.toISOString(),
          bookId: post.bookId || null
        });
      });

      setPlan({ structure });
      toast.success(`Wygenerowano ${scheduledPosts.length} postów!`);
      onComplete({ structure }, scheduledPosts);
    } catch (error: any) {
      console.error('Error generating campaign:', error);
      toast.error('Błąd generowania kampanii', {
        description: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-subtle">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h3 className="text-xl font-semibold">Generowanie kampanii z Grok AI</h3>
            <p className="text-sm text-muted-foreground">
              Tworzę strategiczny plan {totalPosts} postów na {config.durationDays} dni
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card className="p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <h4 className="font-semibold">Content (80%)</h4>
            </div>
            <p className="text-2xl font-bold text-blue-500">{contentPosts} postów</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ciekawostki, zagadki, wydarzenia literackie
            </p>
          </Card>

          <Card className="p-4 bg-green-500/10 border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <h4 className="font-semibold">Sprzedaż (20%)</h4>
            </div>
            <p className="text-2xl font-bold text-green-500">{salesPosts} postów</p>
            <p className="text-sm text-muted-foreground mt-1">
              Promocje, rekomendacje, oferty specjalne
            </p>
          </Card>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold mb-2">Co zostanie wygenerowane:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>✓ Strategiczny plan rozmieszczenia postów contentowych i sprzedażowych</li>
            <li>✓ Różnorodne kategorie contentowe (ciekawostki, zagadki, wydarzenia)</li>
            <li>✓ Unikalne treści dla każdego posta dostosowane do kategorii</li>
            <li>✓ Automatyczny harmonogram publikacji w wybranych godzinach</li>
          </ul>
        </div>

        {!isGenerating ? (
          <div className="flex gap-3">
            <Button onClick={onBack} variant="outline" className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Wstecz
            </Button>
            <Button onClick={handleGenerate} className="flex-1" size="lg">
              <Sparkles className="mr-2 h-4 w-4" />
              Wygeneruj kampanię
            </Button>
          </div>
        ) : (
          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold">Grok AI tworzy Twoją kampanię...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  To może potrwać 30-60 sekund
                </p>
              </div>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};