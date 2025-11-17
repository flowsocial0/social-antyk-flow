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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlatformAITextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: any;
  platform: string;
  existingContent?: any;
}

export const PlatformAITextDialog = ({
  open,
  onOpenChange,
  book,
  platform,
  existingContent,
}: PlatformAITextDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customText, setCustomText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const platformNames: Record<string, string> = {
    x: "X (Twitter)",
    facebook: "Facebook",
    instagram: "Instagram",
    youtube: "YouTube",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
  };

  const platformSpecs: Record<string, { maxChars: number; features: string[] }> = {
    x: {
      maxChars: 280,
      features: ["Emocjonalny hook", "1-2 hashtagi", "Call-to-action"],
    },
    facebook: {
      maxChars: 2000,
      features: ["Storytelling", "Emocje", "Zachęta do komentarzy"],
    },
    instagram: {
      maxChars: 2200,
      features: ["Wizualny opis", "10-20 hashtagów", "Link w bio"],
    },
    youtube: {
      maxChars: 5000,
      features: ["Podsumowanie", "Timestampy", "Linki"],
    },
    linkedin: {
      maxChars: 3000,
      features: ["Profesjonalny ton", "Fakty i liczby", "Rozwój zawodowy"],
    },
    tiktok: {
      maxChars: 2200,
      features: ["Casualowy język", "Trendowe hashtagi", "Kreatywność"],
    },
  };

  const spec = platformSpecs[platform] || platformSpecs.x;

  const generateMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const { data, error } = await supabase.functions.invoke("generate-sales-text", {
        body: {
          bookData: {
            title: book.title,
            code: book.code,
            description: book.description,
            sale_price: book.sale_price,
            product_url: book.product_url,
          },
          platform: platform,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setCustomText(data.salesText);
      toast({
        title: "Tekst wygenerowany",
        description: `Tekst dla ${platformNames[platform]} został utworzony przez AI`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd generowania",
        description: error.message || "Nie udało się wygenerować tekstu",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate book ID is a proper UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!book?.id || !uuidRegex.test(book.id)) {
        throw new Error("Nieprawidłowy ID książki. Odśwież stronę i spróbuj ponownie.");
      }

      if (existingContent) {
        // Update existing content
        const { error } = await (supabase as any)
          .from("book_platform_content")
          .update({
            ai_generated_text: customText,
            custom_text: customText,
          })
          .eq("id", existingContent.id);
        if (error) throw error;
      } else {
        // Create new content
        const { error } = await (supabase as any)
          .from("book_platform_content")
          .insert({
            book_id: book.id,
            platform: platform,
            ai_generated_text: customText,
            custom_text: customText,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-content"] });
      toast({
        title: "Zapisano tekst",
        description: "Tekst został zapisany pomyślnie",
      });
      onOpenChange(false);
      setCustomText("");
    },
    onError: (error: any) => {
      toast({
        title: "Błąd zapisu",
        description: error.message || "Nie udało się zapisać tekstu",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handleSave = () => {
    if (!customText.trim()) {
      toast({
        title: "Brak tekstu",
        description: "Wprowadź lub wygeneruj tekst przed zapisaniem",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Tekst AI dla {platformNames[platform]}
          </DialogTitle>
          <DialogDescription>
            Wygeneruj lub edytuj tekst sprzedażowy dla książki: {book.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Platform specs */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Specyfikacja platformy</p>
              <Badge variant="secondary">{spec.maxChars} znaków max</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {spec.features.map((feature) => (
                <Badge key={feature} variant="outline" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>

          {/* Text area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Tekst posta</label>
              <span className="text-xs text-muted-foreground">
                {customText.length} / {spec.maxChars} znaków
              </span>
            </div>
            <Textarea
              placeholder={`Kliknij "Generuj AI" lub wprowadź własny tekst...`}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              maxLength={spec.maxChars}
            />
          </div>

          {/* Existing text info */}
          {existingContent?.ai_generated_text && !customText && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Ta książka ma już wygenerowany tekst. Możesz go edytować lub wygenerować nowy.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating || saveMutation.isPending}
          >
            Anuluj
          </Button>
          <Button
            variant="secondary"
            onClick={handleGenerate}
            disabled={isGenerating || saveMutation.isPending}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generowanie...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generuj AI
              </>
            )}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isGenerating || saveMutation.isPending || !customText.trim()}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Zapisywanie...
              </>
            ) : (
              "Zapisz"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
