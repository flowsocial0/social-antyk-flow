import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Send, Calendar, Eye, ExternalLink, Undo2, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { PlatformAITextDialog } from "./PlatformAITextDialog";
import { PlatformScheduleDialog } from "./PlatformScheduleDialog";
import { XPostPreviewDialog } from "@/components/books/XPostPreviewDialog";

type SortColumn = "code" | "title" | "published";
type SortDirection = "asc" | "desc";

interface PlatformBooksListProps {
  platform: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const PlatformBooksList = ({ platform, searchQuery, onSearchChange }: PlatformBooksListProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sortColumn, setSortColumn] = useState<SortColumn>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const { data: contentData, isLoading } = useQuery({
    queryKey: ["platform-content", platform, sortColumn, sortDirection, searchQuery],
    queryFn: async () => {
      let query = (supabase as any)
        .from("book_platform_content")
        .select(`
          *,
          book:books(*)
        `)
        .eq("platform", platform);

      if (searchQuery.trim()) {
        // We'll need to filter by book title/code after fetching
      }

      const { data, error } = await query.order(
        sortColumn === "published" ? "published" : `book.${sortColumn}`,
        { ascending: sortDirection === "asc" }
      );

      if (error) throw error;

      // Filter by search query if provided
      if (searchQuery.trim()) {
        return data.filter((item: any) => {
          const book = item.book;
          return (
            book.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            book.title?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        });
      }

      return data;
    },
  });

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

  const publishMutation = useMutation({
    mutationFn: async ({ contentId, bookId }: { contentId: string; bookId: string }) => {
      const { data, error } = await supabase.functions.invoke("publish-to-x", {
        body: { contentId, bookId, platform },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-content"] });
      toast({
        title: "Opublikowano pomyślnie",
        description: "Post został opublikowany na X",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd publikacji",
        description: error.message || "Nie udało się opublikować",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setPublishingIds(new Set());
    },
  });

  const handlePublish = (contentId: string, bookId: string) => {
    setPublishingIds((prev) => new Set(prev).add(contentId));
    publishMutation.mutate({ contentId, bookId });
  };

  const cancelScheduleMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const { error } = await (supabase as any)
        .from("book_platform_content")
        .update({ auto_publish_enabled: false, scheduled_publish_at: null })
        .eq("id", contentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-content"] });
      toast({
        title: "Harmonogram anulowany",
        description: "Automatyczna publikacja została wyłączona",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się anulować harmonogramu",
        variant: "destructive",
      });
    },
  });

  const handleGenerateAI = (bookId: string) => {
    setSelectedBookId(bookId);
    setAiDialogOpen(true);
  };

  const handleSchedule = (bookId: string) => {
    setSelectedBookId(bookId);
    setScheduleDialogOpen(true);
  };

  const handlePreview = (bookId: string) => {
    setSelectedBookId(bookId);
    setPreviewDialogOpen(true);
  };

  const handleBulkGenerateAI = async () => {
    if (!contentData || contentData.length === 0) {
      toast({
        title: "Brak książek",
        description: "Nie ma książek do wygenerowania tekstów AI",
        variant: "destructive",
      });
      return;
    }

    const booksWithoutAI = contentData.filter((c: any) => !c.ai_generated_text);
    
    if (booksWithoutAI.length === 0) {
      toast({
        title: "Wszystkie książki mają teksty AI",
        description: "Wszystkie książki już mają wygenerowane teksty AI",
      });
      return;
    }

    setIsBulkGenerating(true);
    let successCount = 0;
    let errorCount = 0;

    toast({
      title: "Rozpoczęto generowanie",
      description: `Generowanie tekstów AI dla ${booksWithoutAI.length} książek...`,
    });

    for (const content of booksWithoutAI) {
      try {
        const { data, error } = await supabase.functions.invoke("generate-sales-text", {
          body: {
            bookData: content.book,
            platform,
          },
        });

        if (error) throw error;

        const updateData: any = {
          ai_generated_text: data.salesText,
        };

        if (content.id) {
          await (supabase as any)
            .from("book_platform_content")
            .update(updateData)
            .eq("id", content.id);
        } else {
          await (supabase as any).from("book_platform_content").insert({
            book_id: content.book.id,
            platform,
            ...updateData,
          });
        }

        successCount++;
      } catch (error) {
        console.error("Error generating AI text:", error);
        errorCount++;
      }
    }

    setIsBulkGenerating(false);
    queryClient.invalidateQueries({ queryKey: ["platform-content"] });

    toast({
      title: "Generowanie zakończone",
      description: `Wygenerowano: ${successCount}, Błędy: ${errorCount}`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const selectedBook = contentData?.find((c: any) => c.book.id === selectedBookId)?.book;
  const selectedContent = contentData?.find((c: any) => c.book.id === selectedBookId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Książki</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleBulkGenerateAI}
            disabled={isBulkGenerating}
            variant="outline"
            className="gap-2"
          >
            {isBulkGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generuj AI dla wszystkich
          </Button>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj po kodzie lub tytule..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 w-[300px]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Okładka</TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort("code")}
              >
                Kod <SortIcon column="code" />
              </TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort("title")}
              >
                Tytuł <SortIcon column="title" />
              </TableHead>
              <TableHead>Tekst AI</TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort("published")}
              >
                Status <SortIcon column="published" />
              </TableHead>
              <TableHead>Harmonogram</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contentData?.map((content: any) => {
              const book = content.book;
              const isPublishing = publishingIds.has(content.id);

              return (
                <TableRow key={content.id}>
                  <TableCell>
                    {book.image_url ? (
                      <img
                        src={book.image_url}
                        alt={book.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-16 bg-muted rounded flex items-center justify-center text-xs">
                        Brak
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{book.code}</TableCell>
                  <TableCell className="max-w-xs truncate">{book.title}</TableCell>
                  <TableCell>
                    {content.ai_generated_text ? (
                      <Badge variant="secondary">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Wygenerowano
                      </Badge>
                    ) : (
                      <Badge variant="outline">Brak</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {content.published ? (
                      <Badge variant="default">Opublikowano</Badge>
                    ) : content.auto_publish_enabled ? (
                      <Badge variant="secondary">Zaplanowano</Badge>
                    ) : (
                      <Badge variant="outline">Oczekuje</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {content.scheduled_publish_at ? (
                      <span className="text-sm text-muted-foreground">
                        {new Date(content.scheduled_publish_at).toLocaleString("pl-PL")}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateAI(book.id)}
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        AI
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreview(book.id)}
                        disabled={!content.ai_generated_text}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!content.published && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSchedule(book.id)}
                            disabled={!content.ai_generated_text}
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          {content.auto_publish_enabled ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelScheduleMutation.mutate(content.id)}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handlePublish(content.id, book.id)}
                              disabled={!content.ai_generated_text || isPublishing}
                            >
                              {isPublishing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </>
                      )}
                      {book.product_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(book.product_url, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedBook && (
        <>
          <PlatformAITextDialog
            open={aiDialogOpen}
            onOpenChange={setAiDialogOpen}
            book={selectedBook}
            platform={platform}
            existingContent={selectedContent}
          />
          <PlatformScheduleDialog
            open={scheduleDialogOpen}
            onOpenChange={setScheduleDialogOpen}
            contentId={selectedContent?.id}
            bookTitle={selectedBook.title}
          />
          <XPostPreviewDialog
            open={previewDialogOpen}
            onOpenChange={setPreviewDialogOpen}
            book={selectedBook}
          />
        </>
      )}
    </div>
  );
};
