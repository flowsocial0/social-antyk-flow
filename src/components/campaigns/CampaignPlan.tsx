import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowLeft, BookOpen, TrendingUp, FileText } from "lucide-react";
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
  const salesPosts = Math.floor(totalPosts * 0.8);
  const contentPosts = totalPosts - salesPosts;
  const useAI = config.useAI !== false; // Default to true

  const handleGenerateWithAI = async () => {
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
          postsPerDay: config.postsPerDay,
          selectedBooks: config.selectedBooks
        }
      });

      if (structureResponse.error) throw structureResponse.error;
      
      // Check for API-level errors (rate limit, auth issues)
      if (structureResponse.data?.success === false) {
        throw new Error(structureResponse.data.error || 'Błąd API podczas generowania struktury');
      }

      const structure = structureResponse.data.structure;
      console.log("Structure generated:", structure);

      // Step 2: Generate content for each post
      console.log("Generating post content...");
      const contentResponse = await supabase.functions.invoke('generate-campaign', {
        body: {
          action: 'generate_posts',
          structure,
          targetPlatforms: config.targetPlatforms,
          selectedBooks: config.selectedBooks
        }
      });

      if (contentResponse.error) throw contentResponse.error;
      
      // Check for API-level errors (rate limit, auth issues)
      if (contentResponse.data?.success === false) {
        throw new Error(contentResponse.data.error || 'Błąd API podczas generowania treści');
      }

      const generatedPosts = contentResponse.data.posts;
      console.log("Posts generated:", generatedPosts.length);

      // Step 3: Schedule posts
      const scheduledPosts = scheduleGeneratedPosts(generatedPosts);

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

  const handleGenerateWithoutAI = async () => {
    setIsGenerating(true);
    try {
      // Fetch selected books from database
      const { data: books, error } = await supabase
        .from('books')
        .select('*')
        .in('id', config.selectedBooks || []);

      if (error) throw error;
      if (!books || books.length === 0) {
        throw new Error('Nie znaleziono wybranych książek');
      }

      console.log("Generating campaign without AI, books:", books.length);

      // Create structure without AI
      const structure: any[] = [];
      let salesIndex = 0;
      let contentIndex = 0;

      for (let i = 0; i < totalPosts; i++) {
        const isSalesPost = contentIndex >= contentPosts || 
          (salesIndex < salesPosts && (i % 5 !== 0 || contentIndex >= contentPosts));
        
        if (isSalesPost) {
          structure.push({
            position: i + 1,
            type: 'sales',
            category: 'promocja'
          });
          salesIndex++;
        } else {
          structure.push({
            position: i + 1,
            type: 'content',
            category: 'informacja'
          });
          contentIndex++;
        }
      }

      // Generate posts from book descriptions
      const generatedPosts: any[] = [];
      
      for (let i = 0; i < structure.length; i++) {
        const item = structure[i];
        const bookIndex = i % books.length;
        const book = books[bookIndex];
        
        let text = '';
        
        if (item.type === 'sales') {
          // Sales post - use book description or generate simple promo
          const title = book.title || '';
          const author = book.author || '';
          const description = book.description || '';
          const price = book.sale_price || book.promotional_price;
          const url = book.product_url || 'https://sklep.antyk.org.pl';
          
          // Create a simple promotional text
          if (description && description.length > 50) {
            // Use first 200 chars of description
            const shortDesc = description.substring(0, 200).trim();
            text = `📚 ${title}${author ? ` - ${author}` : ''}\n\n${shortDesc}...${price ? `\n\n💰 Cena: ${price} zł` : ''}\n\n👉 ${url}`;
          } else {
            text = `📚 Polecamy: ${title}${author ? ` - ${author}` : ''}${price ? `\n💰 Cena: ${price} zł` : ''}\n\n👉 Zamów teraz: ${url}`;
          }
        } else {
          // Content post - use book info to create an informational post
          const title = book.title || '';
          const author = book.author || '';
          const description = book.description || '';
          
          if (description && description.length > 30) {
            const shortDesc = description.substring(0, 150).trim();
            text = `📖 ${title}${author ? ` - ${author}` : ''}\n\n${shortDesc}...`;
          } else {
            text = `📖 Warto przeczytać: ${title}${author ? ` - ${author}` : ''}`;
          }
        }
        
        generatedPosts.push({
          type: item.type,
          category: item.category,
          text: text.trim(),
          bookId: book.id
        });
      }

      // Schedule posts
      const scheduledPosts = scheduleGeneratedPosts(generatedPosts);

      setPlan({ structure });
      toast.success(`Utworzono ${scheduledPosts.length} postów z opisów książek!`);
      onComplete({ structure }, scheduledPosts);
    } catch (error: any) {
      console.error('Error generating campaign without AI:', error);
      toast.error('Błąd tworzenia kampanii', {
        description: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const scheduleGeneratedPosts = (generatedPosts: any[]): CampaignPost[] => {
    const scheduledPosts: CampaignPost[] = [];
    const [year, month, day] = config.startDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);

    generatedPosts.forEach((post: any, index: number) => {
      const dayIndex = Math.floor(index / config.postsPerDay);
      const timeIndex = index % config.postsPerDay;
      
      const postDate = new Date(startDate);
      postDate.setDate(postDate.getDate() + dayIndex);
      
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

    return scheduledPosts;
  };

  const handleGenerate = () => {
    if (useAI) {
      handleGenerateWithAI();
    } else {
      handleGenerateWithoutAI();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-subtle">
        <div className="flex items-center gap-3 mb-6">
          {useAI ? (
            <Sparkles className="h-6 w-6 text-primary" />
          ) : (
            <FileText className="h-6 w-6 text-primary" />
          )}
          <div>
            <h3 className="text-xl font-semibold">
              {useAI ? "Generowanie kampanii z Grok AI" : "Tworzenie kampanii z opisów"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {useAI 
                ? `Tworzę strategiczny plan ${totalPosts} postów na ${config.durationDays} dni`
                : `Tworzę ${totalPosts} postów z opisów książek na ${config.durationDays} dni`}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card className="p-4 bg-green-500/10 border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <h4 className="font-semibold">Sprzedaż (80%)</h4>
            </div>
            <p className="text-2xl font-bold text-green-500">{salesPosts} postów</p>
            <p className="text-sm text-muted-foreground mt-1">
              Promocje, rekomendacje, oferty specjalne
            </p>
          </Card>

          <Card className="p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <h4 className="font-semibold">Content (20%)</h4>
            </div>
            <p className="text-2xl font-bold text-blue-500">{contentPosts} postów</p>
            <p className="text-sm text-muted-foreground mt-1">
              {useAI ? "Ciekawostki nawiązujące do oferowanych książek" : "Informacje o książkach"}
            </p>
          </Card>

          <Card className="p-4 bg-amber-500/10 border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-amber-500" />
              <h4 className="font-semibold">Wybrane książki</h4>
            </div>
            <p className="text-2xl font-bold text-amber-500">{config.selectedBooks?.length || 0}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pozycje do promocji w kampanii
            </p>
          </Card>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold mb-2">Co zostanie {useAI ? "wygenerowane" : "utworzone"}:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {useAI ? (
              <>
                <li>✓ Strategiczny plan rozmieszczenia postów contentowych i sprzedażowych</li>
                <li>✓ Ciekawostki nawiązujące do najbliższej promowanej książki</li>
                <li>✓ Unikalne treści dla każdego posta dostosowane do kategorii</li>
                <li>✓ Automatyczny harmonogram publikacji w wybranych godzinach</li>
              </>
            ) : (
              <>
                <li>✓ Posty sprzedażowe z opisów książek z bazy danych</li>
                <li>✓ Posty informacyjne z krótkich opisów książek</li>
                <li>✓ Automatyczne rotowanie między wybranymi książkami</li>
                <li>✓ Automatyczny harmonogram publikacji w wybranych godzinach</li>
              </>
            )}
          </ul>
        </div>

        {!isGenerating ? (
          <div className="flex gap-3">
            <Button onClick={onBack} variant="outline" className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Wstecz
            </Button>
            <Button onClick={handleGenerate} className="flex-1" size="lg">
              {useAI ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Wygeneruj kampanię
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Utwórz kampanię
                </>
              )}
            </Button>
          </div>
        ) : (
          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold">
                  {useAI ? "Grok AI tworzy Twoją kampanię..." : "Tworzę kampanię z opisów książek..."}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {useAI ? "To może potrwać 30-60 sekund" : "To zajmie tylko chwilę"}
                </p>
              </div>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};