import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export const BooksList = () => {
  const { data: books, isLoading } = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });


  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista książek</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Tytuł</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cena</TableHead>
                  <TableHead>Publikacja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {books && books.length > 0 ? (
                  books.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell className="font-medium">{book.code}</TableCell>
                      <TableCell className="max-w-md truncate">{book.title}</TableCell>
                      <TableCell>{book.stock_status || "-"}</TableCell>
                      <TableCell>
                        {book.sale_price ? `${book.sale_price} zł` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={book.published ? "default" : "secondary"}>
                          {book.published ? "Opublikowano" : "Nieopublikowano"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Brak książek w bazie
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
