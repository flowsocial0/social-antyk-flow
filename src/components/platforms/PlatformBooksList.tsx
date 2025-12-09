import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Send, Calendar, Eye, ExternalLink, Undo2, Search, ArrowUpDown, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { PlatformAITextDialog } from "./PlatformAITextDialog";
import { PlatformScheduleDialog } from "./PlatformScheduleDialog";
import { XPostPreviewDialog } from "@/components/books/XPostPreviewDialog";
import { EditBookDialog } from "@/components/books/EditBookDialog";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  
  // Debounce state for search
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Sync local state with prop
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);
  
  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(localSearchQuery);
      onSearchChange(localSearchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  const { data: contentData, isLoading } = useQuery({
    queryKey: ["platform-content", platform, sortColumn, sortDirection, debouncedSearch],
    queryFn: async () => {
      // Fetch all books with LEFT JOIN to book_platform_content for this platform
      let query = (supabase as any)
        .from("books")
        .select(`
          *,
          platform_content:book_platform_content!left(*)
        `);

      const { data: booksData, error } = await query;

      if (error) throw error;

      // Transform data to include platform-specific content
      let transformedData = booksData.map((book: any) => {
        // Find content for current platform (if exists)
        const platformContent = book.platform_content?.find((c: any) => c.platform === platform);
        
        return {
          id: platformContent?.id || `temp-${book.id}`, // temporary ID for books without content
          book_id: book.id,
          book: book,
          platform: platform,
          ai_generated_text: platformContent?.ai_generated_text || null,
          custom_text: platformContent?.custom_text || null,
          published: platformContent?.published || false,
          published_at: platformContent?.published_at || null,
          auto_publish_enabled: platformContent?.auto_publish_enabled || false,
          scheduled_publish_at: platformContent?.scheduled_publish_at || null,
          post_id: platformContent?.post_id || null,
          media_urls: platformContent?.media_urls || null,
          mentions: platformContent?.mentions || null,
          hashtags: platformContent?.hashtags || null,
          _hasContent: !!platformContent, // flag to know if content exists
        };
      });

      // Filter by search query if provided
      if (debouncedSearch.trim()) {
        transformedData = transformedData.filter((item: any) => {
          return (
            item.book.code?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            item.book.title?.toLowerCase().includes(debouncedSearch.toLowerCase())
          );
        });
      }

      // Sort the data
      transformedData.sort((a: any, b: any) => {
        let aVal, bVal;
        
        if (sortColumn === "published") {
          aVal = a.published ? 1 : 0;
          bVal = b.published ? 1 : 0;
        } else if (sortColumn === "code") {
          aVal = a.book.code || "";
          bVal = b.book.code || "";
        } else { // title
          aVal = a.book.title || "";
          bVal = b.book.title || "";
        }

        if (sortDirection === "asc") {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      return transformedData;
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
      // Get current session for Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Musisz być zalogowany aby publikować');
      }

      // Select the correct function based on platform
      const functionName = platform === 'x' ? 'publish-to-x' : 
                          platform === 'facebook' ? 'publish-to-facebook' : 
                          'publish-to-x'; // fallback to X for other platforms

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { contentId, bookId, platform },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      // CRITICAL: Check top-level success field
      if (data && data.success === false) {
        // Extract first error from results if available
        const firstError = data.results?.find((r: any) => !r.success)?.error;
        throw new Error(firstError || data.error || 'Publikacja nie powiodła się');
      }

      // Additional validation for results array
      if (data && data.results) {
        const failed = data.results.filter((r: any) => !r.success);
        if (failed.length > 0) {
          throw new Error(failed[0].error || 'Publikacja nie powiodła się');
        }
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["platform-content"] });
      const platformName = platform === 'x' ? 'X' : platform === 'facebook' ? 'Facebooku' : platform;
      toast({
        title: "✅ Opublikowano pomyślnie",
        description: `Post został opublikowany na ${platformName}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Błąd publikacji",
        description: error.message || "Nie udało się opublikować",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setPublishingIds(new Set());
    },
  });

  // Helper function to ensure content exists before actions
  const ensureContentExists = async (bookId: string, existingContentId?: string) => {
    if (existingContentId && !existingContentId.startsWith('temp-')) {
      return existingContentId;
    }

    // Create new content record
    const { data, error } = await (supabase as any)
      .from("book_platform_content")
      .insert({
        book_id: bookId,
        platform: platform,
      })
      .select()
      .single();

    if (error) throw error;
    
    // Invalidate queries to refresh the list
    queryClient.invalidateQueries({ queryKey: ["platform-content"] });
    
    return data.id;
  };

  const handlePublish = async (contentId: string, bookId: string) => {
    try {
      const actualContentId = await ensureContentExists(bookId, contentId);
      setPublishingIds((prev) => new Set(prev).add(actualContentId));
      publishMutation.mutate({ contentId: actualContentId, bookId });
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się przygotować publikacji",
        variant: "destructive",
      });
    }
  };

  const handleRepublish = async (contentId: string, bookId: string) => {
    try {
      // Reset published status
      const { error: resetError } = await (supabase as any)
        .from("book_platform_content")
        .update({ published: false, published_at: null, post_id: null })
        .eq("id", contentId);

      if (resetError) throw resetError;

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["platform-content"] });

      // Proceed with publication
      setPublishingIds((prev) => new Set(prev).add(contentId));
      publishMutation.mutate({ contentId, bookId });
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się przygotować ponownej publikacji",
        variant: "destructive",
      });
    }
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

  const handleSchedule = async (bookId: string, contentId: string) => {
    try {
      await ensureContentExists(bookId, contentId);
      setSelectedBookId(bookId);
      setScheduleDialogOpen(true);
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się przygotować planowania",
        variant: "destructive",
      });
    }
  };

  const handlePreview = (bookId: string) => {
    setSelectedBookId(bookId);
    setPreviewDialogOpen(true);
  };

  const handleEdit = (bookId: string) => {
    setSelectedBookId(bookId);
    setEditDialogOpen(true);
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

        // Always ensure content exists for bulk generation
        if (content._hasContent && !content.id.startsWith('temp-')) {
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
              ref={searchInputRef}
              placeholder="Szukaj po kodzie lub tytule..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="pl-8 w-[300px]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Okładka</TableHead>
              <TableHead 
                className="cursor-pointer w-20"
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
              <TableHead className="w-32">Autor</TableHead>
              <TableHead className="w-28">Data publikacji</TableHead>
              <TableHead className="text-right w-45">Akcje</TableHead>
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
                  <TableCell className="font-medium">
                    {book.code}
                  </TableCell>
                  <TableCell className="truncate" title={book.title}>{book.title}</TableCell>
                  <TableCell className="truncate text-sm text-muted-foreground" title={book.author || ''}>
                    {book.author || '-'}
                  </TableCell>
                  <TableCell>
                    {content.published_at ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">
                          {new Date(content.published_at).toLocaleDateString("pl-PL")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(content.published_at).toLocaleTimeString("pl-PL")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {content.published ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRepublish(content.id, book.id)}
                          disabled={!content.ai_generated_text || isPublishing}
                          title="Opublikuj ponownie"
                        >
                          {isPublishing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Undo2 className="h-4 w-4 mr-1" />
                            </>
                          )}
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSchedule(book.id, content.id)}
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(book.id)}
                        title="Edytuj książkę"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateAI(book.id)}
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreview(book.id)}
                        disabled={!content.ai_generated_text}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
            aiGeneratedText={selectedContent?.ai_generated_text}
          />
          <EditBookDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            book={selectedBook}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["platform-content"] })}
          />
        </>
      )}
    </div>
  );
};
