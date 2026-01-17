import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { Copy, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CopyCampaignDialogProps {
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
    content_posts_count: number;
    sales_posts_count: number;
  };
  selectedBooks: string[];
}

export const CopyCampaignDialog = ({
  open,
  onOpenChange,
  campaign,
  selectedBooks,
}: CopyCampaignDialogProps) => {
  const navigate = useNavigate();

  const handleCopy = () => {
    // Prepare campaign config to pass via URL state
    const configToCopy = {
      name: `${campaign.name} - kopia`,
      durationDays: campaign.duration_days,
      postsPerDay: campaign.posts_per_day,
      postingTimes: campaign.posting_times || ["10:00", "18:00"],
      targetPlatforms: campaign.target_platforms || ["x"],
      selectedBooks: selectedBooks,
      contentRatio: campaign.content_posts_count + campaign.sales_posts_count > 0
        ? Math.round((campaign.content_posts_count / (campaign.content_posts_count + campaign.sales_posts_count)) * 100)
        : 20,
    };

    // Navigate to new campaign page with pre-filled config
    navigate("/campaigns/new", { 
      state: { 
        copiedConfig: configToCopy,
        sourceCampaignName: campaign.name 
      } 
    });
    
    onOpenChange(false);
  };

  const totalPosts = campaign.content_posts_count + campaign.sales_posts_count;
  const contentRatio = totalPosts > 0 
    ? Math.round((campaign.content_posts_count / totalPosts) * 100) 
    : 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Kopiuj kampanię
          </DialogTitle>
          <DialogDescription>
            Utwórz nową kampanię na podstawie istniejącej konfiguracji. 
            Możesz dostosować wszystkie parametry przed uruchomieniem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source campaign info */}
          <Card className="p-4 bg-secondary/30">
            <h4 className="font-medium mb-3">Kopiowana kampania</h4>
            <p className="text-lg font-semibold">{campaign.name}</p>
            
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div>
                <span className="text-muted-foreground">Czas trwania:</span>
                <span className="font-medium ml-2">{campaign.duration_days} dni</span>
              </div>
              <div>
                <span className="text-muted-foreground">Postów dziennie:</span>
                <span className="font-medium ml-2">{campaign.posts_per_day}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Proporcja:</span>
                <span className="font-medium ml-2">{contentRatio}% / {100 - contentRatio}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Książki:</span>
                <span className="font-medium ml-2">{selectedBooks.length}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(campaign.target_platforms || []).map((platform: string) => (
                <Badge key={platform} variant="secondary">
                  {platform}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Info */}
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <p className="text-sm text-muted-foreground">
              Po kliknięciu "Kopiuj i edytuj" zostaniesz przeniesiony do kreatora kampanii 
              z wypełnionymi parametrami. Możesz zmienić:
            </p>
            <ul className="text-sm mt-2 space-y-1 text-muted-foreground list-disc list-inside">
              <li>Nazwę kampanii</li>
              <li>Czas trwania i liczbę postów</li>
              <li>Godziny publikacji</li>
              <li>Wybrane platformy i książki</li>
              <li>Proporcję postów contentowych/sprzedażowych</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Anuluj
          </Button>
          <Button onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Kopiuj i edytuj
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
