import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, Calendar, CheckCircle, BookOpen, TrendingUp, Edit2, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import type { CampaignPost, CampaignConfig } from "./CampaignBuilder";

interface CampaignReviewProps {
  posts: CampaignPost[];
  config: CampaignConfig;
  onBack: () => void;
}

export const CampaignReview = ({ posts, config, onBack }: CampaignReviewProps) => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");
  const [localPosts, setLocalPosts] = useState(posts);
  const navigate = useNavigate();

  const contentPosts = localPosts.filter(p => p.type === 'content').length;
  const salesPosts = localPosts.filter(p => p.type === 'sales').length;

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditedText(localPosts[index].text);
  };

  const handleSaveEdit = (index: number) => {
    const newPosts = [...localPosts];
    newPosts[index].text = editedText;
    setLocalPosts(newPosts);
    setEditingIndex(null);
    toast.success("Post zaktualizowany");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditedText("");
  };

  const handleScheduleAll = async () => {
    setIsScheduling(true);
    try {
      // Create campaign entry
      const campaignName = `Kampania ${format(parseISO(config.startDate), 'dd.MM.yyyy', { locale: pl })}`;
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: campaignName,
          description: `Kampania ${config.durationDays} dni, ${config.postsPerDay} postów dziennie`,
          status: 'scheduled',
          duration_days: config.durationDays,
          posts_per_day: config.postsPerDay,
          content_posts_count: contentPosts,
          sales_posts_count: salesPosts,
          start_date: config.startDate,
          posting_times: config.postingTimes,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create entries in campaign_posts table
      for (const post of localPosts) {
        const { error: postError } = await supabase.from('campaign_posts').insert({
          campaign_id: campaignData.id,
          day: post.day,
          time: post.time,
          type: post.type,
          category: post.category,
          text: post.text,
          scheduled_at: post.scheduledAt,
          book_id: (post as any).bookId || null,
          status: 'scheduled'
        });

        if (postError) throw postError;

        // If this is a sales post with a book reference, update the book's campaign counter
        if (post.type === 'sales' && (post as any).bookId) {
          const { data: bookData } = await supabase
            .from('books')
            .select('campaign_post_count')
            .eq('id', (post as any).bookId)
            .single();

          await supabase
            .from('books')
            .update({
              campaign_post_count: ((bookData as any)?.campaign_post_count || 0) + 1,
              last_campaign_date: new Date().toISOString()
            } as any)
            .eq('id', (post as any).bookId);
        }
      }

      toast.success(`Zaplanowano kampanię z ${localPosts.length} postami!`, {
        description: "Kampania zostanie automatycznie publikowana zgodnie z harmonogramem"
      });
      
      // Navigate to campaign details page
      setTimeout(() => {
        navigate(`/campaigns/${campaignData.id}`);
      }, 1500);
    } catch (error: any) {
      console.error('Error scheduling campaign:', error);
      toast.error('Błąd planowania kampanii', {
        description: error.message
      });
    } finally {
      setIsScheduling(false);
    }
  };

  // Group posts by day
  const postsByDay = localPosts.reduce((acc, post) => {
    if (!acc[post.day]) {
      acc[post.day] = [];
    }
    acc[post.day].push(post);
    return acc;
  }, {} as Record<number, CampaignPost[]>);

  // Calculate date range
  const firstPostDate = localPosts[0]?.scheduledAt ? format(parseISO(localPosts[0].scheduledAt), 'dd MMM yyyy', { locale: pl }) : '';
  const lastPostDate = localPosts[localPosts.length - 1]?.scheduledAt ? format(parseISO(localPosts[localPosts.length - 1].scheduledAt), 'dd MMM yyyy', { locale: pl }) : '';

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-subtle border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Podsumowanie kampanii</h2>
            <p className="text-muted-foreground">
              {firstPostDate} - {lastPostDate} ({config.durationDays} dni)
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {localPosts.length} postów
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-6 h-6 text-blue-500" />
              <span className="text-sm text-muted-foreground">Posty contentowe</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{contentPosts}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {((contentPosts / localPosts.length) * 100).toFixed(0)}% kampanii
            </div>
          </Card>
          
          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <span className="text-sm text-muted-foreground">Posty sprzedażowe</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{salesPosts}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {((salesPosts / localPosts.length) * 100).toFixed(0)}% kampanii
            </div>
          </Card>
          
          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-6 h-6 text-purple-500" />
              <span className="text-sm text-muted-foreground">Czas trwania</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{config.durationDays}</div>
            <div className="text-xs text-muted-foreground mt-1">
              dni kampanii
            </div>
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-amber-500" />
              <span className="text-sm text-muted-foreground">Częstotliwość</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{config.postsPerDay}</div>
            <div className="text-xs text-muted-foreground mt-1">
              postów dziennie
            </div>
          </Card>
        </div>

        <div className="mt-6 p-4 bg-background/30 rounded-lg">
          <div className="text-sm font-medium text-foreground mb-2">Godziny publikacji:</div>
          <div className="flex flex-wrap gap-2">
            {config.postingTimes.map((time, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {time}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">Szczegółowy harmonogram</h3>
          <Badge variant="secondary">{Object.keys(postsByDay).length} dni</Badge>
        </div>
        
        {Object.entries(postsByDay)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([day, dayPosts]) => {
            const dayDate = dayPosts[0]?.scheduledAt ? format(parseISO(dayPosts[0].scheduledAt), 'EEEE, dd MMMM yyyy', { locale: pl }) : '';
            const dayContentPosts = dayPosts.filter(p => p.type === 'content').length;
            const daySalesPosts = dayPosts.filter(p => p.type === 'sales').length;
            
            return (
              <Card key={day} className="p-5 border-primary/20">
                <div className="flex items-start justify-between mb-4 pb-4 border-b">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      <span className="text-lg font-bold text-foreground">Dzień {day}</span>
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">{dayDate}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="gap-1">
                      <BookOpen className="w-3 h-3" />
                      {dayContentPosts}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {daySalesPosts}
                    </Badge>
                  </div>
                </div>
            
                <div className="space-y-3">
                  {dayPosts.map((post, postIndex) => {
                    const globalIndex = localPosts.findIndex(p => p === post);
                    const isEditing = editingIndex === globalIndex;
                    const postTime = post.scheduledAt ? format(parseISO(post.scheduledAt), 'HH:mm', { locale: pl }) : post.time;
                    
                    return (
                      <div key={postIndex} className="p-4 bg-background rounded-lg border border-border/50 hover:border-primary/50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge 
                              variant={post.type === 'content' ? 'secondary' : 'default'}
                              className="font-medium"
                            >
                              {post.type === 'content' ? '📚 Content' : '💰 Sprzedaż'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {post.category}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{postTime}</span>
                            </div>
                            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                              ⏳ Zaplanowany
                            </Badge>
                          </div>
                          {!isEditing && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(globalIndex)}
                              className="shrink-0"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              className="min-h-[100px]"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelEdit}
                              >
                                Anuluj
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(globalIndex)}
                              >
                                Zapisz
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                              {post.text}
                            </p>
                            {(post as any).bookId && (
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <span className="text-xs text-muted-foreground">
                                  📖 Promowana książka: ID {(post as any).bookId.substring(0, 8)}...
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
      </div>

      <div className="flex gap-3 justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isScheduling}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Wstecz
        </Button>
        
        <Button
          onClick={handleScheduleAll}
          disabled={isScheduling}
          size="lg"
          className="min-w-[200px]"
        >
          {isScheduling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Planowanie...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Zaplanuj kampanię
            </>
          )}
        </Button>
      </div>
    </div>
  );
};