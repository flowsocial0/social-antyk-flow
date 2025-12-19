import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Video } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const bookSchema = z.object({
  code: z.string().min(1, "Kod jest wymagany").max(50, "Kod może mieć maksymalnie 50 znaków"),
  title: z.string().min(1, "Tytuł jest wymagany").max(500, "Tytuł może mieć maksymalnie 500 znaków"),
  image_url: z.string().url("Nieprawidłowy URL").optional().or(z.literal("")),
  video_url: z.string().url("Nieprawidłowy URL").optional().or(z.literal("")),
  sale_price: z.string().optional(),
  promotional_price: z.string().optional(),
  description: z.string().optional(),
  product_url: z.string().url("Nieprawidłowy URL").optional().or(z.literal("")),
  stock_status: z.string().optional(),
});

type BookFormData = z.infer<typeof bookSchema>;

interface EditBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: Tables<"books"> | null;
  onSuccess?: () => void;
}

export const EditBookDialog = ({ open, onOpenChange, book, onSuccess }: EditBookDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const form = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      code: "",
      title: "",
      image_url: "",
      video_url: "",
      sale_price: "",
      promotional_price: "",
      description: "",
      product_url: "",
      stock_status: "",
    },
  });

  // Reset form when book changes
  useEffect(() => {
    if (book) {
      form.reset({
        code: book.code || "",
        title: book.title || "",
        image_url: book.image_url || "",
        video_url: (book as any).video_url || "",
        sale_price: book.sale_price?.toString() || "",
        promotional_price: book.promotional_price?.toString() || "",
        description: book.description || "",
        product_url: book.product_url || "",
        stock_status: book.stock_status || "",
      });
    }
  }, [book, form]);

  const uploadImageFromUrl = async (imageUrl: string, bookId: string): Promise<string | null> => {
    try {
      setIsUploadingImage(true);
      
      // Fetch image through a proxy to avoid CORS
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Nie udało się pobrać obrazu");
      
      const blob = await response.blob();
      
      // Get file extension from URL or content type
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const extension = contentType.split("/")[1]?.split(";")[0] || "jpg";
      const storagePath = `books/${bookId}.${extension}`;
      
      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from("ObrazkiKsiazek")
        .upload(storagePath, blob, { 
          upsert: true,
          contentType 
        });
        
      if (uploadError) throw uploadError;
      
      return storagePath;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const onSubmit = async (data: BookFormData) => {
    if (!book) return;
    
    setIsSubmitting(true);
    try {
      const bookData: any = {
        code: data.code,
        title: data.title,
        description: data.description || null,
        sale_price: data.sale_price ? parseFloat(data.sale_price) : null,
        promotional_price: data.promotional_price ? parseFloat(data.promotional_price) : null,
        product_url: data.product_url || null,
        stock_status: data.stock_status || null,
        video_url: data.video_url || null,
      };

      // Handle image URL - upload to storage if it's a new URL
      if (data.image_url && data.image_url !== book.image_url) {
        bookData.image_url = data.image_url;
        
        // Try to upload to storage
        const storagePath = await uploadImageFromUrl(data.image_url, book.id);
        if (storagePath) {
          bookData.storage_path = storagePath;
          toast({
            title: "Obraz zapisany",
            description: "Okładka została pobrana i zapisana w storage",
          });
        }
      } else if (data.image_url) {
        bookData.image_url = data.image_url;
      } else {
        bookData.image_url = null;
        bookData.storage_path = null;
      }

      const { error } = await supabase
        .from("books")
        .update(bookData)
        .eq("id", book.id);

      if (error) throw error;

      toast({
        title: "Sukces",
        description: "Książka została zaktualizowana",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating book:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować książki",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj książkę</DialogTitle>
          <DialogDescription>
            Zmień dane książki
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kod produktu *</FormLabel>
                    <FormControl>
                      <Input placeholder="np. BOOK001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status magazynowy</FormLabel>
                    <FormControl>
                      <Input placeholder="np. Dostępny" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tytuł *</FormLabel>
                  <FormControl>
                    <Input placeholder="Tytuł książki" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opis</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Szczegółowy opis książki" 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sale_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cena sprzedaży</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="49.99" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="promotional_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cena promocyjna</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="39.99" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    URL okładki
                    {isUploadingImage && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Pobieranie...
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/cover.jpg" {...field} />
                  </FormControl>
                  <FormMessage />
                  {book.storage_path && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Upload className="h-3 w-3" />
                      Zapisano w storage: {book.storage_path}
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="video_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    URL wideo (dla TikTok, Instagram Reels, YouTube Shorts)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/video.mp4" {...field} />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Wideo będzie używane dla platform obsługujących tylko wideo (TikTok, YouTube)
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL produktu</FormLabel>
                  <FormControl>
                    <Input placeholder="https://sklep.pl/produkt" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={isSubmitting || isUploadingImage}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Zapisz zmiany
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
