import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { XPostPreview } from "./XPostPreview";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";

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

  const isVisualTemplate = book.template_type === "visual";

  const renderTextTemplate = () => {
    let tweetText = `📚 Nowość w ofercie!\n\n${book.title}\n\n`;
    
    if (book.promotional_price && book.promotional_price > 0) {
      tweetText += `💰 Cena: ${book.sale_price} zł\n🔥 Promocja: ${book.promotional_price} zł\n\n`;
    } else if (book.sale_price) {
      tweetText += `💰 Cena: ${book.sale_price} zł\n\n`;
    }
    
    if (book.product_url) {
      tweetText += `Sprawdź: ${book.product_url}\n\n`;
    }
    
    tweetText += `#ksiazki #antyk #promocja`;

    return (
      <Card className="max-w-xl bg-card">
        <CardContent className="p-6">
          <pre className="whitespace-pre-wrap font-sans text-card-foreground">{tweetText}</pre>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Podgląd posta na X
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Szablon: {isVisualTemplate ? "Wizualny" : "Tekstowy"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          {isVisualTemplate ? <XPostPreview book={book} /> : renderTextTemplate()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
