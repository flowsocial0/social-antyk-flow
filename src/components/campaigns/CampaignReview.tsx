import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, Calendar, CheckCircle, BookOpen, TrendingUp, Edit2 } from "lucide-react";
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
      // Create entries in books table for scheduled posts
      for (const post of localPosts) {
        await supabase.from('books').insert({
          title: `Kampania ${post.type === 'content' ? 'Content' : 'Sprzedaż'} - Dzień ${post.day}`,
          code: `CAMPAIGN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ai_generated_text: post.text,
          scheduled_publish_at: post.scheduledAt,
          auto_publish_enabled: true,
          product_url: 'https://sklep.antyk.org.pl',
          template_type: 'text'
        });

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
              campaign_post_count: (bookData?.campaign_post_count || 0) + 1,
              last_campaign_date: new Date().toISOString()
            })
            .eq('id', (post as any).bookId);
        }
      }

      toast.success(`Zaplanowano ${localPosts.length} postów!`, {
        description: "Kampania zostanie automatycznie publikowana zgodnie z harmonogramem"
      });
      
      // Navigate to schedule page after short delay
      setTimeout(() => {
        navigate('/schedule');
      }, 1500);
    } catch (error: any) {
      console.error('Error scheduling posts:', error);
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

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="p-6 bg-gradient-subtle border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Podsumowanie kampanii</h3>
          <Badge variant="outline" className="text-base px-4 py-1">
            {localPosts.length} postów
          </Badge>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">{contentPosts}</p>
              <p className="text-sm text-muted-foreground">Posty contentowe</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{salesPosts}</p>
              <p className="text-sm text-muted-foreground">Posty sprzedażowe</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Posts by day */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Harmonogram publikacji
        </h3>
        
        {Object.entries(postsByDay).map(([day, dayPosts]) => (
          <Card key={day} className="p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              Dzień {day}
              <span className="text-sm text-muted-foreground font-normal">
                ({format(parseISO(dayPosts[0].scheduledAt), 'dd MMMM yyyy', { locale: pl })})
              </span>
            </h4>
            
            <div className="space-y-3">
              {dayPosts.map((post, idx) => {
                const globalIndex = localPosts.findIndex(p => p === post);
                const isEditing = editingIndex === globalIndex;
                
                return (
                  <Card key={idx} className={`p-4 ${post.type === 'content' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={post.type === 'content' ? 'secondary' : 'default'}>
                            {post.type === 'content' ? 'Content' : 'Sprzedaż'}
                          </Badge>
                          <Badge variant="outline">{post.category}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {post.time}
                          </span>
                        </div>
                        
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              rows={4}
                              className="w-full"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveEdit(globalIndex)}>
                                Zapisz
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                Anuluj
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm whitespace-pre-wrap">{post.text}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Długość: {post.text.length} znaków
                            </p>
                          </>
                        )}
                      </div>
                      
                      {!isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(globalIndex)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button onClick={onBack} variant="outline" className="flex-1" disabled={isScheduling}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Wstecz
        </Button>
        <Button 
          onClick={handleScheduleAll} 
          className="flex-1" 
          size="lg"
          disabled={isScheduling}
        >
          {isScheduling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Planowanie...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Zatwierdź i zaplanuj kampanię
            </>
          )}
        </Button>
      </div>
    </div>
  );
};