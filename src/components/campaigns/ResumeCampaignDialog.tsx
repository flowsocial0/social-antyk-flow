import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Calendar, Clock } from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { Card } from "@/components/ui/card";

interface ResumeCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: {
    id: string;
    name: string;
    duration_days: number;
    posts_per_day: number;
    start_date: string;
    posting_times: string[];
    target_platforms: string[];
    selected_accounts?: Record<string, string[]>;
  };
  posts: Array<{
    id: string;
    day: number;
    time: string;
    type: string;
    category: string;
    text: string;
    book_id: string | null;
    platforms: string[];
    target_accounts?: Record<string, string[]>;
    custom_image_url?: string | null;
  }>;
}

export const ResumeCampaignDialog = ({
  open,
  onOpenChange,
  campaign,
  posts,
}: ResumeCampaignDialogProps) => {
  const navigate = useNavigate();
  const [isResuming, setIsResuming] = useState(false);
  
  // Calculate end date of original campaign
  const originalEndDate = addDays(parseISO(campaign.start_date), campaign.duration_days);
  const defaultStartDate = format(addDays(originalEndDate, 1), "yyyy-MM-dd");
  
  const [newName, setNewName] = useState(`${campaign.name} - kontynuacja`);
  const [multiplier, setMultiplier] = useState("1");
  const [startDate, setStartDate] = useState(defaultStartDate);
  
  const multiplierValue = parseInt(multiplier);
  const newDurationDays = campaign.duration_days * multiplierValue;
  const newPostsCount = posts.length * multiplierValue;

  const handleResume = async () => {
    setIsResuming(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Musisz być zalogowany");
        setIsResuming(false);
        return;
      }

      // Create new campaign - include selected_accounts from original campaign
      const { data: newCampaign, error: campaignError } = await (supabase as any)
        .from('campaigns')
        .insert({
          name: newName,
          description: `Kontynuacja kampanii "${campaign.name}" - ${newDurationDays} dni, ${campaign.posts_per_day} postów dziennie`,
          status: 'scheduled',
          duration_days: newDurationDays,
          posts_per_day: campaign.posts_per_day,
          content_posts_count: posts.filter(p => p.type === 'content').length * multiplierValue,
          sales_posts_count: posts.filter(p => p.type === 'sales').length * multiplierValue,
          start_date: startDate,
          posting_times: campaign.posting_times,
          target_platforms: campaign.target_platforms,
          selected_accounts: campaign.selected_accounts || {},
          user_id: user.id,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create posts for each iteration
      const startDateObj = parseISO(startDate);
      
      for (let iteration = 0; iteration < multiplierValue; iteration++) {
        for (const originalPost of posts) {
          // Calculate new day number
          const newDay = iteration * campaign.duration_days + originalPost.day;
          
          // Calculate new scheduled_at
          const scheduledDate = addDays(startDateObj, newDay - 1);
          const [hours, minutes] = originalPost.time.split(':').map(Number);
          scheduledDate.setHours(hours, minutes, 0, 0);
          
          // Include target_accounts from original post, or fall back to campaign's selected_accounts
          const postTargetAccounts = originalPost.target_accounts || campaign.selected_accounts || {};
          
          const { error: postError } = await (supabase as any)
            .from('campaign_posts')
            .insert({
              campaign_id: newCampaign.id,
              day: newDay,
              time: originalPost.time,
              type: originalPost.type,
              category: originalPost.category,
              text: originalPost.text,
              book_id: originalPost.book_id,
              scheduled_at: scheduledDate.toISOString(),
              status: 'scheduled',
              platforms: originalPost.platforms || campaign.target_platforms,
              target_accounts: postTargetAccounts,
              custom_image_url: originalPost.custom_image_url || null,
            });

          if (postError) throw postError;
        }
      }

      toast.success(`Utworzono nową kampanię z ${newPostsCount} postami!`);
      onOpenChange(false);
      navigate(`/campaigns/${newCampaign.id}`);
    } catch (error: any) {
      console.error('Error resuming campaign:', error);
      toast.error('Błąd podczas wznawiania kampanii', {
        description: error.message,
      });
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Wznów kampanię
          </DialogTitle>
          <DialogDescription>
            Utwórz nową kampanię na podstawie istniejącej, z możliwością powtórzenia postów wielokrotnie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* New campaign name */}
          <div className="space-y-2">
            <Label htmlFor="newName">Nazwa nowej kampanii</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Podaj nazwę kampanii"
            />
          </div>

          {/* Multiplier */}
          <div className="space-y-2">
            <Label>Wielokrotność kampanii</Label>
            <Select value={multiplier} onValueChange={setMultiplier}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">×1 (powtórz 1:1) - {campaign.duration_days} dni</SelectItem>
                <SelectItem value="2">×2 (podwójnie) - {campaign.duration_days * 2} dni</SelectItem>
                <SelectItem value="3">×3 (potrójnie) - {campaign.duration_days * 3} dni</SelectItem>
                <SelectItem value="4">×4 - {campaign.duration_days * 4} dni</SelectItem>
                <SelectItem value="5">×5 - {campaign.duration_days * 5} dni</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Posty z oryginalnej kampanii zostaną skopiowane {multiplierValue} raz{multiplierValue > 1 ? 'y' : ''}
            </p>
          </div>

          {/* Start date */}
          <div className="space-y-2">
            <Label htmlFor="startDate">Data rozpoczęcia</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Domyślnie: dzień po zakończeniu oryginalnej kampanii
            </p>
          </div>

          {/* Preview */}
          <Card className="p-4 bg-secondary/30">
            <h4 className="font-medium mb-3">Podgląd nowej kampanii</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Czas trwania:</span>
                <span className="font-medium">{newDurationDays} dni</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Łącznie postów:</span>
                <span className="font-medium">{newPostsCount}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              Zakres: {format(parseISO(startDate), 'd MMM yyyy', { locale: pl })} - {format(addDays(parseISO(startDate), newDurationDays - 1), 'd MMM yyyy', { locale: pl })}
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isResuming}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleResume}
            disabled={isResuming || !newName.trim()}
          >
            {isResuming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Tworzenie...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Wznów kampanię
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
