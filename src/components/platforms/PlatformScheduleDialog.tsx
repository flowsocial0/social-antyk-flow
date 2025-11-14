import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface PlatformScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId?: string;
  bookTitle: string;
}

export const PlatformScheduleDialog = ({
  open,
  onOpenChange,
  contentId,
  bookTitle,
}: PlatformScheduleDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scheduledDate, setScheduledDate] = useState("");

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!contentId) throw new Error("Brak ID treści");
      if (!scheduledDate) throw new Error("Wybierz datę publikacji");

      const { error } = await (supabase as any)
        .from("book_platform_content")
        .update({
          auto_publish_enabled: true,
          scheduled_publish_at: scheduledDate,
        })
        .eq("id", contentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-content"] });
      toast({
        title: "Zaplanowano publikację",
        description: `Post zostanie opublikowany ${new Date(scheduledDate).toLocaleString("pl-PL")}`,
      });
      onOpenChange(false);
      setScheduledDate("");
    },
    onError: (error: any) => {
      toast({
        title: "Błąd harmonogramu",
        description: error.message || "Nie udało się zaplanować publikacji",
        variant: "destructive",
      });
    },
  });

  const handleSchedule = () => {
    if (!scheduledDate) {
      toast({
        title: "Brak daty",
        description: "Wybierz datę i godzinę publikacji",
        variant: "destructive",
      });
      return;
    }

    const selectedDate = new Date(scheduledDate);
    const now = new Date();

    if (selectedDate <= now) {
      toast({
        title: "Nieprawidłowa data",
        description: "Data publikacji musi być w przyszłości",
        variant: "destructive",
      });
      return;
    }

    scheduleMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zaplanuj publikację</DialogTitle>
          <DialogDescription>
            Wybierz datę i godzinę automatycznej publikacji dla: {bookTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="scheduled-date">Data i godzina publikacji</Label>
            <Input
              id="scheduled-date"
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="text-xs text-muted-foreground">
              Post zostanie automatycznie opublikowany o wybranej dacie i godzinie
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={scheduleMutation.isPending}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={scheduleMutation.isPending || !scheduledDate}
          >
            {scheduleMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Planowanie...
              </>
            ) : (
              "Zaplanuj"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
