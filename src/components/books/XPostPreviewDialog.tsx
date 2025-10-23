import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { XPostPreview } from "./XPostPreview";
import type { Tables } from "@/integrations/supabase/types";

interface XPostPreviewDialogProps {
  book: Tables<"books"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const XPostPreviewDialog = ({
  book,
  open,
  onOpenChange,
}: XPostPreviewDialogProps) => {
  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Podgląd posta na X
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Tak będzie wyglądał post dla tej książki na platformie X (Twitter)
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <XPostPreview book={book} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
