import { useState, useRef } from "react";
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
import { Loader2, Upload, ImageIcon, X } from "lucide-react";

const bookSchema = z.object({
  code: z.string().min(1, "Kod jest wymagany").max(50, "Kod może mieć maksymalnie 50 znaków"),
  title: z.string().min(1, "Tytuł jest wymagany").max(500, "Tytuł może mieć maksymalnie 500 znaków"),
  image_url: z.string().url("Nieprawidłowy URL").optional().or(z.literal("")),
  sale_price: z.string().optional(),
  promotional_price: z.string().optional(),
  description: z.string().optional(),
  product_url: z.string().url("Nieprawidłowy URL").optional().or(z.literal("")),
  stock_status: z.string().optional(),
});

type BookFormData = z.infer<typeof bookSchema>;

interface AddBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AddBookDialog = ({ open, onOpenChange, onSuccess }: AddBookDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      code: "",
      title: "",
      image_url: "",
      sale_price: "",
      promotional_price: "",
      description: "",
      product_url: "",
      stock_status: "",
    },
  });

  const uploadImageFromUrl = async (imageUrl: string, bookId: string): Promise<string | null> => {
    try {
      setIsUploadingImage(true);
      
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Nie udało się pobrać obrazu");
      
      const blob = await response.blob();
      
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const extension = contentType.split("/")[1]?.split(";")[0] || "jpg";
      const storagePath = `books/${bookId}.${extension}`;
      
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

  const uploadImageFromFile = async (file: File, bookId: string): Promise<string | null> => {
    try {
      setIsUploadingImage(true);
      
      const extension = file.name.split('.').pop() || 'jpg';
      // Add timestamp to avoid browser cache issues
      const timestamp = Date.now();
      const storagePath = `books/${bookId}_${timestamp}.${extension}`;
      
      const { error: uploadError } = await supabase.storage
        .from("ObrazkiKsiazek")
        .upload(storagePath, file, { 
          upsert: true,
          contentType: file.type
        });
        
      if (uploadError) throw uploadError;
      
      return storagePath;
    } catch (error) {
      console.error("Error uploading image from file:", error);
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      // Clear the URL field when a file is selected
      form.setValue('image_url', '');
    }
  };

  const handleRemoveImageFile = () => {
    setSelectedImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: BookFormData) => {
    setIsSubmitting(true);
    try {
      const bookData: any = {
        code: data.code,
        title: data.title,
      };

      if (data.image_url) bookData.image_url = data.image_url;
      if (data.sale_price) bookData.sale_price = parseFloat(data.sale_price);
      if (data.promotional_price) bookData.promotional_price = parseFloat(data.promotional_price);
      if (data.description) bookData.description = data.description;
      if (data.product_url) bookData.product_url = data.product_url;
      if (data.stock_status) bookData.stock_status = data.stock_status;

      const { data: insertedBook, error } = await supabase
        .from("books")
        .insert(bookData)
        .select()
        .single();

      if (error) throw error;

      // Try to upload image to storage if file selected (priority) or URL provided
      if (insertedBook) {
        let storagePath: string | null = null;
        
        if (selectedImageFile) {
          storagePath = await uploadImageFromFile(selectedImageFile, insertedBook.id);
        } else if (data.image_url) {
          storagePath = await uploadImageFromUrl(data.image_url, insertedBook.id);
        }
        
        if (storagePath) {
          await supabase
            .from("books")
            .update({ storage_path: storagePath })
            .eq("id", insertedBook.id);
          
          toast({
            title: "Obraz zapisany",
            description: "Okładka została zapisana w storage",
          });
        }
      }

      toast({
        title: "Sukces",
        description: "Książka została dodana pomyślnie",
      });

      form.reset();
      handleRemoveImageFile();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error adding book:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się dodać książki",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj książkę</DialogTitle>
          <DialogDescription>
            Wypełnij formularz aby dodać nową książkę do bazy
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

            {/* Image upload section */}
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2">
                Okładka książki
                {isUploadingImage && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Przesyłanie...
                  </span>
                )}
              </FormLabel>
              
              {/* File upload */}
              <div className="space-y-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                
                {selectedImageFile ? (
                  <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                    {imagePreview && (
                      <img 
                        src={imagePreview} 
                        alt="Podgląd okładki" 
                        className="h-16 w-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedImageFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedImageFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveImageFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full justify-start gap-2"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Wybierz plik z dysku
                  </Button>
                )}
              </div>

              {/* Divider */}
              {!selectedImageFile && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex-1 border-t" />
                  <span>lub</span>
                  <div className="flex-1 border-t" />
                </div>
              )}
              
              {/* URL input (only show when no file selected) */}
              {!selectedImageFile && (
                <FormField
                  control={form.control}
                  name="image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="https://example.com/cover.jpg" {...field} />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Upload className="h-3 w-3" />
                        Obraz zostanie automatycznie pobrany do storage
                      </p>
                    </FormItem>
                  )}
                />
              )}
            </div>

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
                Dodaj książkę
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
