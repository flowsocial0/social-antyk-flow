import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowLeft, BookOpen, TrendingUp, FileText, CheckCircle2 } from "lucide-react";
import type { CampaignConfig, CampaignPost } from "./CampaignBuilder";

type GenerationStage = 'idle' | 'generating' | 'scheduling';

interface CampaignPlanProps {
  config: CampaignConfig;
  onComplete: (plan: { structure: any[] }, posts: CampaignPost[]) => void;
  onBack: () => void;
}

export const CampaignPlan = ({ config, onComplete, onBack }: CampaignPlanProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [generationStage, setGenerationStage] = useState<GenerationStage>('idle');
  const [stageProgress, setStageProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const totalPosts = config.durationDays * config.postsPerDay;
  const isRandomContent = !!config.useRandomContent;
  const contentRatio = isRandomContent ? 100 : (config.contentRatio ?? 20); // Default to 20% if not set
  const contentPosts = isRandomContent ? totalPosts : (totalPosts === 1 ? 0 : Math.floor(totalPosts * (contentRatio / 100)));
  const salesPosts = isRandomContent ? 0 : (totalPosts - contentPosts);
  const useAI = config.useAI !== false; // Default to true

  // Timer effect for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isGenerating) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  // Animated progress - based on 2.5s per post from the start
  useEffect(() => {
    if (generationStage === 'idle' || generationStage === 'scheduling') {
      return;
    }

    // Reset progress when stage changes
    setStageProgress(0);
    
    const targetProgress = 95;
    // 2.5 seconds per post for generating stage
    const duration = totalPosts * 2500; // 2.5s per post in ms
    
    const updateInterval = 100; // Update every 100ms
    const increment = targetProgress / (duration / updateInterval);
    
    const interval = setInterval(() => {
      setStageProgress(prev => {
        if (prev >= targetProgress) {
          return prev;
        }
        return Math.min(prev + increment, targetProgress);
      });
    }, updateInterval);
    
    return () => clearInterval(interval);
  }, [generationStage, totalPosts]);

  const getStageInfo = () => {
    switch (generationStage) {
      case 'generating':
        return { 
          label: `Generowanie ${totalPosts} postów...`, 
          percentage: stageProgress
        };
      case 'scheduling':
        return { 
          label: 'Finalizowanie...', 
          percentage: 98
        };
      default:
        return { label: '', percentage: 0 };
    }
  };

  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    setGenerationStage('generating');
    try {
      // Fetch cached texts if not regenerating
      let cachedTexts: Record<string, Record<string, string>> = {};
      
      console.log("Config regenerateTexts:", config.regenerateTexts);
      console.log("Config selectedBooks count:", config.selectedBooks?.length);
      
      if (!config.regenerateTexts && config.selectedBooks && config.selectedBooks.length > 0) {
        console.log("Fetching ALL cached texts from book_campaign_texts...");
        
        // Fetch ALL cached texts (table is small) - avoid .in() with large arrays
        const { data: cached, error: cacheError } = await supabase
          .from('book_campaign_texts')
          .select('*');
        
        if (cacheError) {
          console.error("Error fetching cached texts:", cacheError);
        } else if (cached && cached.length > 0) {
          console.log(`Total cached texts in database: ${cached.length}`);
          
          // Filter to only selected books on client side
          const selectedBooksSet = new Set(config.selectedBooks);
          cached
            .filter((item: any) => selectedBooksSet.has(item.book_id))
            .forEach((item: any) => {
              if (!cachedTexts[item.book_id]) {
                cachedTexts[item.book_id] = {};
              }
              // Key: platform_type (e.g., "x_sales", "facebook_content")
              cachedTexts[item.book_id][`${item.platform}_${item.post_type}`] = item.text;
            });
          console.log(`Found cached texts for ${Object.keys(cachedTexts).length} selected books`);
          console.log("CachedTexts book IDs:", Object.keys(cachedTexts).slice(0, 10).join(", ") + (Object.keys(cachedTexts).length > 10 ? "..." : ""));
        } else {
          console.log("No cached texts found in database");
        }
      } else {
        console.log("Skipping cache fetch - regenerateTexts:", config.regenerateTexts);
      }
      
      // Generate campaign structure
      console.log("Generating campaign structure...");
      const structureResponse = await supabase.functions.invoke('generate-campaign', {
        body: {
          action: 'generate_structure',
          totalPosts,
          contentPosts,
          salesPosts,
          durationDays: config.durationDays,
          postsPerDay: config.postsPerDay,
          selectedBooks: config.selectedBooks,
          useRandomContent: config.useRandomContent || false,
          randomContentTopic: config.randomContentTopic || ''
        }
      });

      if (structureResponse.error) throw structureResponse.error;
      
      // Check for API-level errors (rate limit, auth issues)
      if (structureResponse.data?.success === false) {
        throw new Error(structureResponse.data.error || 'Błąd API podczas generowania struktury');
      }

      const structure = structureResponse.data.structure;
      console.log("Structure generated:", structure);

      // Generate content for each post
      console.log("Generating post content...");
      console.log("Passing cachedTexts to edge function, keys count:", Object.keys(cachedTexts).length);
      console.log("useRandomContent:", config.useRandomContent);
      console.log("randomContentTopic:", config.randomContentTopic);
      
      // Get current user ID for user_settings lookup
      const { data: { user } } = await supabase.auth.getUser();
      
      const contentResponse = await supabase.functions.invoke('generate-campaign', {
        body: {
          action: 'generate_posts',
          structure,
          targetPlatforms: config.targetPlatforms,
          selectedBooks: config.selectedBooks,
          cachedTexts: Object.keys(cachedTexts).length > 0 ? cachedTexts : null,
          regenerateTexts: config.regenerateTexts || false,
          useRandomContent: config.useRandomContent || false,
          randomContentTopic: config.randomContentTopic || '',
          userId: user?.id
        }
      });

      if (contentResponse.error) throw contentResponse.error;
      
      // Check for API-level errors (rate limit, auth issues)
      if (contentResponse.data?.success === false) {
        throw new Error(contentResponse.data.error || 'Błąd API podczas generowania treści');
      }

      const generatedPosts = contentResponse.data.posts;
      console.log("Posts generated:", generatedPosts.length);

      // Schedule posts
      setGenerationStage('scheduling');
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
      setGenerationStage('idle');
      setStageProgress(0);
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
        const title = book.title || '';
        const author = book.author || '';
        const price = book.sale_price || book.promotional_price;
        const url = book.product_url || 'https://sklep.antyk.org.pl';
        
        // Priority for text: Platform-specific AI > legacy AI > description > empty
        // Get primary platform for text selection
        const primaryPlatform = config.targetPlatforms?.[0] || 'x';
        
        // Get platform-specific AI text
        let aiText = '';
        if (primaryPlatform === 'x' && book.ai_text_x) {
          aiText = book.ai_text_x;
        } else if (primaryPlatform === 'facebook' && book.ai_text_facebook) {
          aiText = book.ai_text_facebook;
        } else if (book.ai_generated_text) {
          // Fallback to legacy AI text
          aiText = book.ai_generated_text;
        }
        
        const description = book.description || '';
        
        // Determine which text to use: AI > description > empty
        let contentText = '';
        if (aiText && aiText.length > 0) {
          contentText = aiText;
        } else if (description && description.length > 0) {
          contentText = description;
        }
        
        if (item.type === 'sales') {
          // Sales post
          if (contentText && contentText.length > 50) {
            const shortText = contentText.substring(0, 200).trim();
            text = `📚 ${title}${author ? ` - ${author}` : ''}\n\n${shortText}...${price ? `\n\n💰 Cena: ${price} zł` : ''}\n\n👉 ${url}`;
          } else if (contentText && contentText.length > 0) {
            text = `📚 ${title}${author ? ` - ${author}` : ''}\n\n${contentText}${price ? `\n\n💰 Cena: ${price} zł` : ''}\n\n👉 ${url}`;
          } else {
            // No text available - leave empty (just basic info)
            text = `📚 ${title}${author ? ` - ${author}` : ''}${price ? `\n💰 Cena: ${price} zł` : ''}\n\n👉 ${url}`;
          }
        } else {
          // Content post
          if (contentText && contentText.length > 30) {
            const shortText = contentText.substring(0, 150).trim();
            text = `📖 ${title}${author ? ` - ${author}` : ''}\n\n${shortText}...\n\n👉 ${url}`;
          } else if (contentText && contentText.length > 0) {
            text = `📖 ${title}${author ? ` - ${author}` : ''}\n\n${contentText}\n\n👉 ${url}`;
          } else {
            // No text available - just basic info
            text = `📖 ${title}${author ? ` - ${author}` : ''}\n\n👉 ${url}`;
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
          {isRandomContent ? (
            <>
              <Card className="p-4 bg-blue-500/10 border-blue-500/20 md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  <h4 className="font-semibold">Ciekawostki (100%)</h4>
                </div>
                <p className="text-2xl font-bold text-blue-500">{contentPosts} postów</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ciekawostki generowane na podany temat (bez książek z bazy)
                </p>
              </Card>

              <Card className="p-4 bg-purple-500/10 border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <h4 className="font-semibold">Temat</h4>
                </div>
                <p className="text-sm font-medium">
                  {config.randomContentTopic?.trim() ? config.randomContentTopic.trim() : "(brak)"}
                </p>
              </Card>
            </>
          ) : (
            <>
              <Card className="p-4 bg-green-500/10 border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <h4 className="font-semibold">Sprzedaż ({100 - contentRatio}%)</h4>
                </div>
                <p className="text-2xl font-bold text-green-500">{salesPosts} postów</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Promocje, rekomendacje, oferty specjalne
                </p>
              </Card>

              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  <h4 className="font-semibold">Ciekawostki ({contentRatio}%)</h4>
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
            </>
          )}
        </div>

        <div className="bg-secondary/50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold mb-2">Co zostanie {useAI ? "wygenerowane" : "utworzone"}:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {useAI ? (
              isRandomContent ? (
                <>
                  <li>✓ {totalPosts} ciekawostek na wybrany temat (bez książek z bazy)</li>
                  <li>✓ Unikalne treści dla każdego posta</li>
                  <li>✓ Automatyczny harmonogram publikacji w wybranych godzinach</li>
                </>
              ) : (
                <>
                  <li>✓ Strategiczny plan rozmieszczenia postów ciekawostek i sprzedażowych</li>
                  <li>✓ Ciekawostki nawiązujące do najbliższej promowanej książki</li>
                  <li>✓ Unikalne treści dla każdego posta dostosowane do kategorii</li>
                  <li>✓ Automatyczny harmonogram publikacji w wybranych godzinach</li>
                </>
              )
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
          <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 shadow-lg animate-in fade-in duration-300">
            <div className="flex flex-col gap-6">
              {/* Main progress indicator */}
              <div className="flex items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold text-lg">{getStageInfo().label}</p>
                    <span className="text-2xl font-bold text-primary">{Math.round(getStageInfo().percentage)}%</span>
                  </div>
                  <Progress value={getStageInfo().percentage} className="h-3" />
                </div>
              </div>

              {/* Time */}
              <div className="flex justify-end text-sm text-muted-foreground">
                <span>Czas: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
              </div>

              {/* Warning */}
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md py-2 px-3">
                ⏳ Proszę nie zamykać tej strony - generowanie jest w toku...
              </p>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};