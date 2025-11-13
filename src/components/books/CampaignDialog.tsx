import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Calendar, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { format, addDays } from "date-fns";
import { pl } from "date-fns/locale";

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId?: string;
  bookData?: {
    title: string;
    description?: string;
    sale_price?: number;
    promotional_price?: number;
    product_url: string;
  };
}

interface GeneratedPost {
  text: string;
  type: string;
}

export const CampaignDialog = ({ open, onOpenChange, bookId, bookData }: CampaignDialogProps) => {
  const [campaignType, setCampaignType] = useState<string>("trivia");
  const [numberOfPosts, setNumberOfPosts] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [startDate, setStartDate] = useState<string>(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState<string>("10:00");
  const [postInterval, setPostInterval] = useState<number>(24); // hours

  const campaignTypes = [
    { value: "trivia", label: "Ciekawostki literackie", icon: "📚" },
    { value: "quiz", label: "Zagadki i quizy", icon: "🧩" },
    { value: "recommendation", label: "Rekomendacje", icon: "⭐" },
    { value: "event", label: "Wydarzenia literackie", icon: "🎭" }
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign', {
        body: {
          campaignType,
          numberOfPosts,
          bookData: bookData
        }
      });

      if (error) throw error;

      if (data?.posts) {
        setGeneratedPosts(data.posts);
        toast.success(`Wygenerowano ${data.posts.length} postów!`);
      }
    } catch (error: any) {
      console.error('Error generating campaign:', error);
      toast.error('Błąd generowania kampanii', {
        description: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSchedule = async () => {
    if (generatedPosts.length === 0) {
      toast.error("Najpierw wygeneruj posty");
      return;
    }

    setIsScheduling(true);
    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      let scheduledDate = new Date(startDate);
      scheduledDate.setHours(hours, minutes, 0, 0);

      for (let i = 0; i < generatedPosts.length; i++) {
        const post = generatedPosts[i];
        
        // For book-specific campaign, update the book with AI text and schedule
        if (bookId && i === 0) {
          // First post updates the original book
          const { error } = await supabase
            .from('books')
            .update({
              ai_generated_text: post.text,
              scheduled_publish_at: scheduledDate.toISOString(),
              auto_publish_enabled: true
            })
            .eq('id', bookId);

          if (error) throw error;
        } else if (!bookId) {
          // For general campaigns, create a new entry without book reference
          // We'll store these as generic scheduled posts
          const { error } = await supabase
            .from('books')
            .insert({
              title: `Kampania ${campaignType} ${i + 1}`,
              code: `CAMPAIGN_${Date.now()}_${i}`,
              ai_generated_text: post.text,
              scheduled_publish_at: scheduledDate.toISOString(),
              auto_publish_enabled: true,
              product_url: 'https://sklep.antyk.org.pl',
              template_type: 'text' // Text-only post
            });

          if (error) throw error;
        }

        // Add interval for next post
        scheduledDate = addDays(scheduledDate, postInterval / 24);
      }

      toast.success(`Zaplanowano ${generatedPosts.length} postów!`);
      onOpenChange(false);
      setGeneratedPosts([]);
    } catch (error: any) {
      console.error('Error scheduling posts:', error);
      toast.error('Błąd planowania postów', {
        description: error.message
      });
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Profesjonalna kampania AI
          </DialogTitle>
          <DialogDescription>
            {bookData 
              ? `Stwórz kampanię dla książki: ${bookData.title}`
              : "Stwórz kampanię promocyjną dla księgarni"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Campaign Type Selection */}
          <div className="space-y-2">
            <Label>Typ kampanii</Label>
            <Select value={campaignType} onValueChange={setCampaignType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {campaignTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Number of Posts */}
          <div className="space-y-2">
            <Label>Liczba postów</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={numberOfPosts}
              onChange={(e) => setNumberOfPosts(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generowanie...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Wygeneruj posty z Grok AI
              </>
            )}
          </Button>

          {/* Generated Posts Preview */}
          {generatedPosts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <Label className="text-base">Wygenerowane posty ({generatedPosts.length})</Label>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {generatedPosts.map((post, index) => (
                  <Card key={index} className="p-3 bg-secondary/50">
                    <p className="text-sm whitespace-pre-wrap">{post.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Długość: {post.text.length} znaków
                    </p>
                  </Card>
                ))}
              </div>

              {/* Scheduling Options */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <Label className="text-base">Harmonogram publikacji</Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data rozpoczęcia</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Godzina</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Odstęp między postami (godziny)</Label>
                  <Select 
                    value={postInterval.toString()} 
                    onValueChange={(v) => setPostInterval(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">Co 6 godzin</SelectItem>
                      <SelectItem value="12">Co 12 godzin</SelectItem>
                      <SelectItem value="24">Co 24 godziny (codziennie)</SelectItem>
                      <SelectItem value="48">Co 48 godzin (co 2 dni)</SelectItem>
                      <SelectItem value="72">Co 72 godziny (co 3 dni)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleSchedule} 
                  disabled={isScheduling}
                  className="w-full"
                  variant="default"
                >
                  {isScheduling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Planowanie...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Zaplanuj kampanię
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};