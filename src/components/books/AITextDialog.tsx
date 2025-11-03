import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface AITextDialogProps {
  book: Tables<"books"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: (bookId: string, customText?: string) => Promise<void>;
}

export const AITextDialog = ({
  book,
  open,
  onOpenChange,
  onPublish,
}: AITextDialogProps) => {
  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleGenerateText = async () => {
    if (!book) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-sales-text", {
        body: {
          bookData: {
            title: book.title,
            code: book.code,
            sale_price: book.sale_price,
            description: book.description,
            stock_status: book.stock_status,
            product_url: book.product_url,
          },
        },
      });

      if (error) throw error;

      if (data?.salesText) {
        // Add product link at the end
        const fullText = data.productUrl 
          ? `${data.salesText}\n\n${data.productUrl}`
          : data.salesText;
        setGeneratedText(fullText);
        toast.success("Tekst wygenerowany przez AI!");
      } else {
        throw new Error("Brak odpowiedzi od AI");
      }
    } catch (error) {
      console.error("Error generating text:", error);
      toast.error("Błąd podczas generowania tekstu");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishWithText = async () => {
    if (!book) return;

    setIsPublishing(true);
    try {
      await onPublish(book.id, generatedText);
      onOpenChange(false);
      setGeneratedText("");
    } catch (error) {
      console.error("Error publishing:", error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setGeneratedText("");
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Generuj tekst sprzedażowy z AI
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Użyj Grok AI do stworzenia skutecznego tekstu sprzedażowego dla książki: {book.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!generatedText ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <p className="text-center text-muted-foreground">
                Kliknij przycisk poniżej, aby wygenerować profesjonalny tekst sprzedażowy
              </p>
              <Button
                onClick={handleGenerateText}
                disabled={isGenerating}
                size="lg"
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generuję...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generuj tekst AI
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Wygenerowany tekst (możesz edytować):
                </label>
                <Textarea
                  value={generatedText}
                  onChange={(e) => setGeneratedText(e.target.value)}
                  rows={8}
                  className="resize-none"
                  placeholder="Tekst sprzedażowy..."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Długość: {generatedText.length} znaków
                </p>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleGenerateText}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generuję...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Wygeneruj ponownie
                    </>
                  )}
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Anuluj
                  </Button>
                  <Button
                    onClick={handlePublishWithText}
                    disabled={isPublishing || !generatedText.trim()}
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Publikuję...
                      </>
                    ) : (
                      "Opublikuj z tym tekstem"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
