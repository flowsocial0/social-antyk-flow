import { useState, useEffect, useRef } from "react";
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
import { Loader2, Upload, Video, X, FileVideo, ImageIcon } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const bookSchema = z.object({
  code: z.string().min(1, "Kod jest wymagany").max(50, "Kod może mieć maksymalnie 50 znaków"),
  title: z.string().min(1, "Tytuł jest wymagany").max(500, "Tytuł może mieć maksymalnie 500 znaków"),
  image_url: z.string().url("Nieprawidłowy URL").optional().or(z.literal("")),
  sale_price: z.string().optional(),
  promotional_price: z.string().optional(),
  description: z.string().optional(),
  product_url: z.string().url("Nieprawidłowy URL").optional().or(z.literal("")),
  stock_status: z.string().optional(),
  ai_text_x: z.string().optional(),
  ai_text_facebook: z.string().optional(),
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
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStoragePath, setVideoStoragePath] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentStoragePath, setCurrentStoragePath] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
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
      ai_text_x: "",
      ai_text_facebook: "",
    },
  });

  // Reset form when book changes
  useEffect(() => {
    if (book) {
      form.reset({
        code: book.code || "",
        title: book.title || "",
        image_url: book.image_url || "",
        sale_price: book.sale_price?.toString() || "",
        promotional_price: book.promotional_price?.toString() || "",
        description: book.description || "",
        product_url: book.product_url || "",
        stock_status: book.stock_status || "",
        ai_text_x: (book as any).ai_text_x || "",
        ai_text_facebook: (book as any).ai_text_facebook || "",
      });
      setVideoUrl((book as any).video_url || null);
      setVideoStoragePath((book as any).video_storage_path || null);
      setCurrentStoragePath(book.storage_path || null);
      setSelectedImageFile(null);
      // Set image preview from storage if available
      if (book.storage_path) {
        const { data: { publicUrl } } = supabase.storage
          .from("ObrazkiKsiazek")
          .getPublicUrl(book.storage_path);
        setImagePreview(publicUrl);
      } else if (book.image_url) {
        setImagePreview(book.image_url);
      } else {
        setImagePreview(null);
      }
    }
  }, [book, form]);

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
      // Add timestamp to avoid browser cache issues when replacing images
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
    setCurrentStoragePath(null);
    setImagePreview(null);
    form.setValue('image_url', '');
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !book) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Błąd",
        description: "Wybierz plik wideo (mp4, mov, webm)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 128MB for TikTok)
    const maxSize = 128 * 1024 * 1024; // 128MB
    if (file.size > maxSize) {
      toast({
        title: "Błąd",
        description: "Plik wideo jest za duży. Maksymalny rozmiar to 128MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingVideo(true);
    try {
      const extension = file.name.split('.').pop() || 'mp4';
      const storagePath = `videos/${book.id}.${extension}`;

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from("ObrazkiKsiazek")
        .upload(storagePath, file, { 
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("ObrazkiKsiazek")
        .getPublicUrl(storagePath);

      setVideoUrl(publicUrl);
      setVideoStoragePath(storagePath);

      toast({
        title: "Sukces",
        description: "Wideo zostało przesłane",
      });
    } catch (error) {
      console.error("Error uploading video:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się przesłać wideo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
      // Reset input
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    }
  };

  const handleRemoveVideo = async () => {
    if (videoStoragePath) {
      try {
        await supabase.storage
          .from("ObrazkiKsiazek")
          .remove([videoStoragePath]);
      } catch (error) {
        console.error("Error removing video from storage:", error);
      }
    }
    setVideoUrl(null);
    setVideoStoragePath(null);
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
        video_url: videoUrl,
        video_storage_path: videoStoragePath,
        ai_text_x: data.ai_text_x || null,
        ai_text_facebook: data.ai_text_facebook || null,
      };

      // Handle image - priority: file upload, then URL, then keep existing
      if (selectedImageFile) {
        const storagePath = await uploadImageFromFile(selectedImageFile, book.id);
        if (storagePath) {
          bookData.storage_path = storagePath;
          bookData.image_url = null; // Clear URL when using file upload
          toast({
            title: "Obraz zapisany",
            description: "Okładka została przesłana i zapisana w storage",
          });
        }
      } else if (data.image_url && data.image_url !== book.image_url) {
        bookData.image_url = data.image_url;
        
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
        bookData.storage_path = currentStoragePath;
      } else if (!imagePreview) {
        // Image was removed
        bookData.image_url = null;
        bookData.storage_path = null;
      } else {
        // Keep existing
        bookData.image_url = book.image_url;
        bookData.storage_path = currentStoragePath;
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

            {/* Image upload section */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                Okładka książki
                {isUploadingImage && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Przesyłanie...
                  </span>
                )}
              </label>
              
              {/* Current image preview */}
              {imagePreview && (
                <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                  <img 
                    src={imagePreview} 
                    alt="Podgląd okładki" 
                    className="h-20 w-14 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    {selectedImageFile ? (
                      <>
                        <p className="text-sm font-medium truncate">{selectedImageFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedImageFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </>
                    ) : currentStoragePath ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Upload className="h-3 w-3" />
                        Zapisano w storage
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Z URL</p>
                    )}
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
              )}

              {/* File upload */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
              
              {!selectedImageFile && (
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

              {/* Divider */}
              {!selectedImageFile && !imagePreview && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex-1 border-t" />
                  <span>lub</span>
                  <div className="flex-1 border-t" />
                </div>
              )}
              
              {/* URL input (only show when no file selected and no preview) */}
              {!selectedImageFile && !imagePreview && (
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

            {/* Video Upload Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Video className="h-4 w-4" />
                Wideo (dla TikTok, Instagram Reels, YouTube Shorts)
              </label>
              
              {videoUrl ? (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileVideo className="h-4 w-4" />
                      <span className="truncate max-w-[300px]">
                        {videoStoragePath || 'Wideo przypisane'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveVideo}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Usuń
                    </Button>
                  </div>
                  <video 
                    src={videoUrl} 
                    controls 
                    className="w-full max-h-[200px] rounded-md bg-muted"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                    id="video-upload"
                    disabled={isUploadingVideo}
                  />
                  <label 
                    htmlFor="video-upload" 
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {isUploadingVideo ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Przesyłanie wideo...</span>
                      </>
                    ) : (
                      <>
                        <Video className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Kliknij aby wybrać wideo z dysku
                        </span>
                        <span className="text-xs text-muted-foreground">
                          MP4, MOV, WebM • Maks. 128MB
                        </span>
                      </>
                    )}
                  </label>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Wideo będzie używane dla platform obsługujących tylko wideo (TikTok, YouTube)
              </p>
            </div>

            {/* AI Text for X */}
            <FormField
              control={form.control}
              name="ai_text_x"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tekst AI dla X (Twitter)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tekst sprzedażowy dla platformy X (max 280 znaków)" 
                      className="min-h-[80px]"
                      maxLength={280}
                      {...field} 
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground text-right">
                    {(field.value?.length || 0)} / 280 znaków
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AI Text for Facebook */}
            <FormField
              control={form.control}
              name="ai_text_facebook"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tekst AI dla Facebook</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tekst sprzedażowy dla platformy Facebook (max 2000 znaków)" 
                      className="min-h-[100px]"
                      maxLength={2000}
                      {...field} 
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground text-right">
                    {(field.value?.length || 0)} / 2000 znaków
                  </div>
                  <FormMessage />
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
              <Button type="submit" disabled={isSubmitting || isUploadingImage || isUploadingVideo}>
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
