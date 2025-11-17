import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, Eye, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Snowflake } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type SortColumn = "code" | "title" | "sale_price";
type SortDirection = "asc" | "desc";

export const GeneralBooksList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [pageInput, setPageInput] = useState<string>("1");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: booksData, isLoading, refetch } = useQuery({
    queryKey: ["general-books", sortColumn, sortDirection, currentPage, debouncedSearchQuery],
    queryFn: async () => {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase.from("books").select("*", { count: "exact" });

      if (debouncedSearchQuery.trim()) {
        query = query.or(
          `code.ilike.%${debouncedSearchQuery}%,title.ilike.%${debouncedSearchQuery}%,sale_price.eq.${parseFloat(debouncedSearchQuery) || 0}`,
        );
      }

      const { data, error, count } = await query
        .order(sortColumn, { ascending: sortDirection === "asc" })
        .range(from, to);

      if (error) throw error;
      return { books: data, totalCount: count || 0 };
    },
  });

  const books = booksData?.books;
  const totalCount = booksData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Restore focus after search completes
  useEffect(() => {
    if (debouncedSearchQuery && searchInputRef.current && !isLoading) {
      searchInputRef.current.focus();
      const length = searchQuery.length;
      searchInputRef.current.setSelectionRange(length, length);
    }
  }, [debouncedSearchQuery, isLoading, searchQuery.length]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    );
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const toggleExcludeFromCampaigns = async (bookId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("books")
        .update({ exclude_from_campaigns: !currentValue })
        .eq("id", bookId);

      if (error) throw error;

      toast({
        title: !currentValue ? "Książka zamrożona" : "Książka odmrożona",
        description: !currentValue 
          ? "Książka nie będzie uczestniczyć w publikacjach i kampaniach" 
          : "Książka może uczestniczyć w publikacjach i kampaniach",
      });

      refetch();
    } catch (error) {
      console.error("Error toggling exclude_from_campaigns:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się zmienić statusu książki",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card border-border/50 shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Lista książek</CardTitle>
          <div className="flex items-center gap-4">
            <Input
              ref={searchInputRef}
              placeholder="Szukaj po kodzie, tytule, cenie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <Badge variant="secondary">
              {totalCount} {totalCount === 1 ? "książka" : totalCount < 5 ? "książki" : "książek"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Okładka</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("code")}
                    className="font-semibold p-0 h-auto hover:bg-transparent"
                  >
                    Kod
                    <SortIcon column="code" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("title")}
                    className="font-semibold p-0 h-auto hover:bg-transparent"
                  >
                    Tytuł
                    <SortIcon column="title" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("sale_price")}
                    className="font-semibold p-0 h-auto hover:bg-transparent"
                  >
                    Cena
                    <SortIcon column="sale_price" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">Publikacja</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books && books.length > 0 ? (
                books.map((book: Tables<"books">) => (
                  <TableRow key={book.id}>
                    <TableCell>
                      {book.image_url ? (
                        <img src={book.image_url} alt={book.title} className="w-16 h-20 object-cover rounded" />
                      ) : (
                        <div className="w-16 h-20 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                          Brak
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{book.code}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="line-clamp-2">{book.title}</div>
                    </TableCell>
                    <TableCell>
                      {book.sale_price ? (
                        <span className="font-semibold">{book.sale_price} zł</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant={book.exclude_from_campaigns ? "destructive" : "ghost"}
                        size="sm"
                        onClick={() => toggleExcludeFromCampaigns(book.id, book.exclude_from_campaigns || false)}
                        title={book.exclude_from_campaigns ? "Odmroź - włącz publikację" : "Zamroź - wyłącz publikację"}
                        className="h-8 w-8 p-0"
                      >
                        <Snowflake className={`h-4 w-4 ${book.exclude_from_campaigns ? 'fill-current' : ''}`} />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {book.product_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(book.product_url!, "_blank")}
                            title="Otwórz link do produktu"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/book/${book.id}`)}
                          title="Zobacz szczegóły"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "Nie znaleziono książek pasujących do wyszukiwania" : "Brak książek w bazie"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Strona {currentPage} z {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={pageInput}
                  onChange={handlePageInputChange}
                  className="w-16 text-center"
                  placeholder={String(currentPage)}
                />
                <span className="text-sm text-muted-foreground">z {totalPages}</span>
              </form>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
