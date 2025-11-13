import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Calendar, Clock, ExternalLink, Eye, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Undo2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ScheduleDialog } from "./ScheduleDialog";
import { BulkScheduleDialog } from "./BulkScheduleDialog";
import { XPostPreviewDialog } from "./XPostPreviewDialog";
import { PublicationMonitor } from "./PublicationMonitor";
import type { Tables } from "@/integrations/supabase/types";

type SortColumn = "code" | "title" | "stock_status" | "sale_price" | "published";
type SortDirection = "asc" | "desc";

export const BooksList = () => {
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [oauthState, setOauthState] = useState<{
    codeVerifier?: string;
    state?: string;
  }>({});
  const [previewBook, setPreviewBook] = useState<Tables<"books"> | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [pageInput, setPageInput] = useState<string>("1");
  const [searchQuery, setSearchQuery] = useState<string>("");
  useEffect(() => { setPageInput(String(currentPage)); }, [currentPage]);
  const {
    data: booksData,
    isLoading
  } = useQuery({
    queryKey: ["books", sortColumn, sortDirection, currentPage, searchQuery],
    queryFn: async () => {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      let query = supabase
        .from("books")
        .select("*", { count: 'exact' });

      // Add search filter if query is not empty
      if (searchQuery.trim()) {
        query = query.or(`code.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%,sale_price.eq.${parseFloat(searchQuery) || 0}`);
      }

      const { data, error, count } = await query
        .order(sortColumn, { ascending: sortDirection === "asc" })
        .range(from, to);
      
      if (error) throw error;
      return { books: data, totalCount: count || 0 };
    }
  });

  const books = booksData?.books;
  const totalCount = booksData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

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
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("publish-to-x", {
        body: { testConnection: true }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const o1 = data?.oauth1;
      const o2 = data?.oauth2;
      const allOk = (o1?.ok) || (o2?.ok);
      toast({
        title: allOk ? "✅ Wynik testu połączenia" : "❌ Problem z połączeniem",
        description: `OAuth 1.0a: ${o1?.ok ? "OK" : `BŁĄD${o1?.error ? ` - ${o1.error}` : ""}`}\nOAuth 2.0: ${o2?.ok ? `OK (użytkownik: ${o2?.user?.username || o2?.user?.name || "?"})` : `BŁĄD${o2?.error ? ` - ${o2.error}` : ""}`}`,
        variant: allOk ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      const message = error.message || "Sprawdź swoje klucze API i uprawnienia w X";
      toast({
        title: "❌ Błąd połączenia",
        description: message.includes("No Twitter access token") ? "Najpierw autoryzuj aplikację klikając 'Autoryzuj Twitter'" : message,
        variant: "destructive"
      });
    }
  });
  const authorizeTwitterMutation = useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/twitter-callback`;
      const {
        data,
        error
      } = await supabase.functions.invoke("twitter-oauth-start", {
        body: {
          redirectUri
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: data => {
      // Store PKCE parameters
      setOauthState({
        codeVerifier: data.codeVerifier,
        state: data.state
      });

      // Store in sessionStorage as backup
      sessionStorage.setItem("twitter_oauth_verifier", data.codeVerifier);
      sessionStorage.setItem("twitter_oauth_state", data.state);

      // Redirect to Twitter
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      toast({
        title: "❌ Błąd autoryzacji",
        description: error.message || "Nie udało się rozpocząć autoryzacji",
        variant: "destructive"
      });
    }
  });
  const publishMutation = useMutation({
    mutationFn: async ({
      bookId,
      bookIds,
      customText
    }: {
      bookId?: string;
      bookIds?: string[];
      customText?: string;
    }) => {
      const {
        data,
        error
      } = await supabase.functions.invoke("publish-to-x", {
        body: {
          bookId,
          bookIds,
          customText
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["books"]
      });
      queryClient.invalidateQueries({ queryKey: ["today-publication-stats"] });
      const {
        summary
      } = data;
      if (summary.successful > 0) {
        toast({
          title: "Opublikowano pomyślnie",
          description: `${summary.successful} książek opublikowano na X`
        });
      }
      if (summary.failed > 0) {
        toast({
          title: "Błąd publikacji",
          description: `${summary.failed} książek nie udało się opublikować`,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      console.error("Publish error:", error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się opublikować",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setPublishingIds(new Set());
    }
  });
  const handlePublishSingle = async (bookId: string, customText?: string) => {
    setPublishingIds(prev => new Set(prev).add(bookId));
    publishMutation.mutate({
      bookId,
      customText
    });
  };
  const handlePublishAll = async () => {
    const unpublishedBooks = books?.filter(book => !book.published) || [];
    if (unpublishedBooks.length === 0) {
      toast({
        title: "Brak książek",
        description: "Wszystkie książki są już opublikowane"
      });
      return;
    }
    const bookIds = unpublishedBooks.map(book => book.id);
    setPublishingIds(new Set(bookIds));
    publishMutation.mutate({
      bookIds
    });
  };


  const schedulePublishMutation = useMutation({
    mutationFn: async ({
      bookId,
      scheduledAt,
      autoPublishEnabled
    }: {
      bookId: string;
      scheduledAt: string | null;
      autoPublishEnabled: boolean;
    }) => {
      const {
        error
      } = await supabase.from("books").update({
        scheduled_publish_at: scheduledAt,
        auto_publish_enabled: autoPublishEnabled
      }).eq("id", bookId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["books"]
      });
      queryClient.invalidateQueries({ queryKey: ["today-publication-stats"] });
      toast({
        title: "Zapisano",
        description: "Harmonogram publikacji został zaktualizowany"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać harmonogramu",
        variant: "destructive"
      });
    }
  });
  const bulkScheduleMutation = useMutation({
    mutationFn: async ({
      intervalMinutes,
      limitDays,
      startTime
    }: {
      intervalMinutes: number;
      limitDays?: number;
      startTime?: Date;
    }) => {
      // Fetch ALL unpublished books from database
      const { data: allBooks, error: fetchError } = await supabase
        .from("books")
        .select("*")
        .eq("published", false)
        .order("code", { ascending: true });

      if (fetchError) throw fetchError;

      let unpublishedBooks = allBooks || [];

      // Calculate how many books to schedule based on posts per day and limit days
      if (limitDays) {
        const postsPerDay = Math.floor((24 * 60) / intervalMinutes);
        const maxBooks = postsPerDay * limitDays;
        unpublishedBooks = unpublishedBooks.slice(0, maxBooks);
      }

      // Determine start time
      const baseTime = startTime || new Date();

      // Schedule each book with increasing time intervals
      const updates = unpublishedBooks.map((book, index) => {
        const scheduledAt = new Date(baseTime);
        scheduledAt.setMinutes(scheduledAt.getMinutes() + intervalMinutes * index);
        return supabase.from("books").update({
          scheduled_publish_at: scheduledAt.toISOString(),
          auto_publish_enabled: true
        }).eq("id", book.id);
      });
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`Nie udało się zaplanować ${errors.length} książek`);
      }
      return unpublishedBooks.length;
    },
    onSuccess: count => {
      queryClient.invalidateQueries({
        queryKey: ["books"]
      });
      queryClient.invalidateQueries({ queryKey: ["books-counts"] });
      queryClient.invalidateQueries({ queryKey: ["today-publication-stats"] });
      toast({
        title: "✅ Zaplanowano publikacje",
        description: `${count} książek zostanie opublikowanych automatycznie`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaplanować publikacji",
        variant: "destructive"
      });
    }
  });
  const handleScheduleChange = (bookId: string, scheduledAt: string | null, autoPublishEnabled: boolean) => {
    schedulePublishMutation.mutate({
      bookId,
      scheduledAt,
      autoPublishEnabled
    });
  };
  const handleBulkSchedule = (intervalMinutes: number, limitDays?: number, startTime?: Date) => {
    bulkScheduleMutation.mutate({
      intervalMinutes,
      limitDays,
      startTime
    });
  };
  const cancelAllScheduledMutation = useMutation({
    mutationFn: async () => {
      // Fetch ALL scheduled books from database
      const { data: allScheduledBooks, error: fetchError } = await supabase
        .from("books")
        .select("*")
        .eq("published", false)
        .eq("auto_publish_enabled", true)
        .not("scheduled_publish_at", "is", null);

      if (fetchError) throw fetchError;

      const scheduledBooks = allScheduledBooks || [];

      const updates = scheduledBooks.map(book =>
        supabase
          .from("books")
          .update({
            auto_publish_enabled: false,
            scheduled_publish_at: null
          })
          .eq("id", book.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`Nie udało się anulować ${errors.length} publikacji`);
      }
      return scheduledBooks.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["books-counts"] });
      queryClient.invalidateQueries({ queryKey: ["today-publication-stats"] });
      toast({
        title: "✅ Anulowano publikacje",
        description: `Anulowano ${count} zaplanowanych publikacji`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się anulować publikacji",
        variant: "destructive"
      });
    }
  });
  const handleCancelAllScheduled = () => {
    cancelAllScheduledMutation.mutate();
  };

  const generateAllAITextsMutation = useMutation({
    mutationFn: async () => {
      // Fetch ALL unpublished books from database without ai_generated_text
      const { data: allBooks, error: fetchError } = await supabase
        .from("books")
        .select("*")
        .eq("published", false)
        .is("ai_generated_text", null);

      if (fetchError) throw fetchError;

      const unpublishedBooks = allBooks || [];
      
      if (unpublishedBooks.length === 0) {
        throw new Error("Brak książek do wygenerowania tekstów");
      }

      const results = [];
      for (const book of unpublishedBooks) {
        try {
          const { data, error } = await supabase.functions.invoke("generate-sales-text", {
            body: { bookData: book }
          });

          if (error) throw error;

          // Save generated text to database
          const { error: updateError } = await supabase
            .from("books")
            .update({ ai_generated_text: data.salesText })
            .eq("id", book.id);

          if (updateError) throw updateError;

          results.push({ id: book.id, success: true });
        } catch (error: any) {
          console.error(`Failed to generate text for book ${book.id}:`, error);
          results.push({ id: book.id, success: false, error: error.message });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (successful > 0) {
        toast({
          title: "✅ Wygenerowano teksty AI",
          description: `Wygenerowano ${successful} tekstów${failed > 0 ? `, ${failed} nieudanych` : ""}`
        });
      }
      
      if (failed > 0 && successful === 0) {
        toast({
          title: "Błąd generowania",
          description: `Nie udało się wygenerować ${failed} tekstów`,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wygenerować tekstów",
        variant: "destructive"
      });
    }
  });

  const unpublishMutation = useMutation({
    mutationFn: async (bookId: string) => {
      const { error } = await supabase
        .from("books")
        .update({ published: false })
        .eq("id", bookId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast({
        title: "Cofnięto publikację",
        description: "Status książki został zmieniony na nieopublikowaną"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się cofnąć publikacji",
        variant: "destructive"
      });
    }
  });

  const handleUnpublish = (bookId: string) => {
    unpublishMutation.mutate(bookId);
  };
  
  const migrateImagesMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("migrate-images-to-storage");
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ Migracja zakończona",
        description: data.message || "Obrazki zostały przeniesione do storage",
      });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd migracji",
        description: error.message || "Nie udało się przenieść obrazków",
        variant: "destructive",
      });
    },
  });
  
  // Fetch counts from database for accurate numbers across all pages
  const { data: countsData } = useQuery({
    queryKey: ["books-counts"],
    queryFn: async () => {
      const [unpublishedResult, scheduledResult] = await Promise.all([
        supabase.from("books").select("id", { count: "exact", head: true }).eq("published", false),
        supabase.from("books").select("id", { count: "exact", head: true }).eq("published", false).eq("auto_publish_enabled", true).not("scheduled_publish_at", "is", null)
      ]);
      return {
        unpublished: unpublishedResult.count || 0,
        scheduled: scheduledResult.count || 0
      };
    }
  });

  const unpublishedCount = countsData?.unpublished || 0;
  const scheduledCount = countsData?.scheduled || 0;
  return (
    <>
      <PublicationMonitor />
      <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Lista książek</CardTitle>
        <div className="flex gap-2">
          <Input
            placeholder="Szukaj po kodzie, tytule lub cenie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 h-8"
          />
          <Button variant="outline" onClick={() => authorizeTwitterMutation.mutate()} disabled={authorizeTwitterMutation.isPending} size="sm">
            {authorizeTwitterMutation.isPending ? "Przekierowywanie..." : "🔑 Zaloguj"}
          </Button>
          <Button variant="outline" onClick={() => testConnectionMutation.mutate()} disabled={testConnectionMutation.isPending} size="sm">
            {testConnectionMutation.isPending ? "Testowanie..." : "🔍 Test połączenia"}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => migrateImagesMutation.mutate()} 
            disabled={migrateImagesMutation.isPending} 
            size="sm"
          >
            {migrateImagesMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Migracja...</> : "📦 Migruj obrazki"}
          </Button>
          <Button
            variant="default"
            onClick={() => generateAllAITextsMutation.mutate()}
            disabled={generateAllAITextsMutation.isPending}
            size="sm"
          >
            {generateAllAITextsMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generowanie...</> : <><Sparkles className="mr-2 h-4 w-4" />Generuj AI dla wszystkich</>}
          </Button>
          <BulkScheduleDialog unpublishedCount={unpublishedCount} onSchedule={handleBulkSchedule} isScheduling={bulkScheduleMutation.isPending} />
          <Button
            variant="outline"
            onClick={handleCancelAllScheduled}
            disabled={scheduledCount === 0 || cancelAllScheduledMutation.isPending}
            size="sm"
          >
            {cancelAllScheduledMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Anuluj wszystkie ({scheduledCount})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div> : <>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <div className="text-sm text-muted-foreground">
                Strona {currentPage} z {totalPages} ({totalCount} książek)
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Poprzednia
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Idź do:</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const n = Math.min(totalPages, Math.max(1, parseInt(pageInput || '1', 10) || 1));
                        setCurrentPage(n);
                      }
                    }}
                    className="w-20 h-8"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const n = Math.min(totalPages, Math.max(1, parseInt(pageInput || '1', 10) || 1));
                      setCurrentPage(n);
                    }}
                  >
                    Idź
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Następna
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("code")}
                  >
                    Kod
                    <SortIcon column="code" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("title")}
                  >
                    Tytuł
                    <SortIcon column="title" />
                  </TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("stock_status")}
                  >
                    Status
                    <SortIcon column="stock_status" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("sale_price")}
                  >
                    Cena
                    <SortIcon column="sale_price" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("published")}
                  >
                    Publikacja
                    <SortIcon column="published" />
                  </TableHead>
                  <TableHead>Tekst AI</TableHead>
                  <TableHead>Harmonogram</TableHead>
                  <TableHead>Podgląd</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {books && books.length > 0 ? books.map(book => <TableRow key={book.id}>
                      <TableCell className="font-medium">{book.code}</TableCell>
                      <TableCell className="max-w-md truncate">{book.title}</TableCell>
                      <TableCell>
                        {book.product_url ? (
                          <a 
                            href={book.product_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-primary hover:text-primary/80 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{book.stock_status || "-"}</TableCell>
                      <TableCell>{book.sale_price ? `${book.sale_price} zł` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={book.published ? "default" : "secondary"}>
                          {book.published ? "Opublikowano" : "Nieopublikowano"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {book.ai_generated_text ? (
                          <div className="text-xs text-muted-foreground truncate" title={book.ai_generated_text}>
                            {book.ai_generated_text}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!book.published && <ScheduleDialog book={book} onScheduleChange={handleScheduleChange} />}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPreviewBook(book);
                            setPreviewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        {!book.published ? (
                          <Button size="sm" variant="outline" onClick={() => handlePublishSingle(book.id)} disabled={publishingIds.has(book.id)}>
                            {publishingIds.has(book.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                                <Send className="mr-2 h-4 w-4" />
                                Opublikuj
                              </>}
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleUnpublish(book.id)}
                            disabled={unpublishMutation.isPending}
                          >
                            {unpublishMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Undo2 className="mr-2 h-4 w-4" />
                                Cofnij
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                     </TableRow>) : <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      Brak książek w bazie
                    </TableCell>
                  </TableRow>}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Strona {currentPage} z {totalPages} ({totalCount} książek)
                </div>
                <div className="flex gap-2 items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Poprzednia
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Idź do:</span>
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const n = Math.min(totalPages, Math.max(1, parseInt(pageInput || '1', 10) || 1));
                          setCurrentPage(n);
                        }
                      }}
                      className="w-20 h-8"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const n = Math.min(totalPages, Math.max(1, parseInt(pageInput || '1', 10) || 1));
                        setCurrentPage(n);
                      }}
                    >
                      Idź
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Następna
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          </>}
      </CardContent>
      <XPostPreviewDialog
        book={previewBook}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
      />
    </Card>
    </>
  );
};