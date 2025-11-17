import { useState } from "react";
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
import { Loader2 } from "lucide-react";

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

  const onSubmit = async (data: BookFormData) => {
    setIsSubmitting(true);
    try {
      const bookData: any = {
        code: data.code,
        title: data.title,
      };

      // Add optional fields only if they have values
      if (data.image_url) bookData.image_url = data.image_url;
      if (data.sale_price) bookData.sale_price = parseFloat(data.sale_price);
      if (data.promotional_price) bookData.promotional_price = parseFloat(data.promotional_price);
      if (data.description) bookData.description = data.description;
      if (data.product_url) bookData.product_url = data.product_url;
      if (data.stock_status) bookData.stock_status = data.stock_status;

      const { error } = await supabase.from("books").insert(bookData);

      if (error) throw error;

      toast({
        title: "Sukces",
        description: "Książka została dodana pomyślnie",
      });

      form.reset();
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

            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL okładki</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/cover.jpg" {...field} />
                  </FormControl>
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
              <Button type="submit" disabled={isSubmitting}>
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
