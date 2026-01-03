import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Send, Calendar, Eye, ExternalLink, Undo2, Search, ArrowUpDown, ArrowUp, ArrowDown, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { PlatformAITextDialog } from "./PlatformAITextDialog";
import { PlatformScheduleDialog } from "./PlatformScheduleDialog";
import { XPostPreviewDialog } from "@/components/books/XPostPreviewDialog";
import { EditBookDialog } from "@/components/books/EditBookDialog";
import { platformRequiresVideo, PlatformId } from "@/config/platforms";

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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [pageInput, setPageInput] = useState<string>("1");
  
  // Debounce state for search
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Sync page input with current page
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);
  
  // Sync local state with prop
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);
  
  // Debounce effect - reset page when search changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(localSearchQuery);
      onSearchChange(localSearchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  const { data: contentData, isLoading } = useQuery({
    queryKey: ["platform-content", platform, sortColumn, sortDirection, debouncedSearch, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // For code column, we need to sort numerically (code is text but contains numbers)
      // Supabase doesn't support numeric cast in order, so we fetch ALL and sort client-side
      if (sortColumn === "code") {
        // Fetch ALL books using pagination (Supabase has 1000 row limit)
        const allBooks: any[] = [];
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          let batchQuery = supabase
            .from("books")
            .select(`
              *,
              platform_content:book_platform_content!left(*)
            `);
          
          if (debouncedSearch.trim()) {
            batchQuery = batchQuery.or(
              `code.ilike.%${debouncedSearch}%,title.ilike.%${debouncedSearch}%`
            );
          }
          
          const { data: batchData, error: batchError } = await batchQuery.range(offset, offset + batchSize - 1);
          
          if (batchError) throw batchError;
          
          if (batchData && batchData.length > 0) {
            allBooks.push(...batchData);
            offset += batchSize;
            hasMore = batchData.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        // Transform and sort
        let transformedData = allBooks.map((book: any) => {
          const platformContent = book.platform_content?.find((c: any) => c.platform === platform);
          return {
            id: platformContent?.id || `temp-${book.id}`,
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
            _hasContent: !!platformContent,
          };
        });

        // Sort numerically by code
        transformedData.sort((a: any, b: any) => {
          const numA = parseInt(a.book.code || "0", 10);
          const numB = parseInt(b.book.code || "0", 10);
          if (isNaN(numA) && isNaN(numB)) return (a.book.code || "").localeCompare(b.book.code || "");
          if (isNaN(numA)) return 1;
          if (isNaN(numB)) return -1;
          return sortDirection === "asc" ? numA - numB : numB - numA;
        });

        const totalCount = transformedData.length;
        const paginatedData = transformedData.slice(from, to + 1);
        
        return { items: paginatedData, totalCount };
      }

      // For other columns, use database sorting with pagination
      let countQuery = supabase.from("books").select("*", { count: "exact", head: true });
      let dataQuery = supabase
        .from("books")
        .select(`
          *,
          platform_content:book_platform_content!left(*)
        `);

      if (debouncedSearch.trim()) {
        countQuery = countQuery.or(`code.ilike.%${debouncedSearch}%,title.ilike.%${debouncedSearch}%`);
        dataQuery = dataQuery.or(`code.ilike.%${debouncedSearch}%,title.ilike.%${debouncedSearch}%`);
      }

      const { count } = await countQuery;

      const { data: booksData, error } = await dataQuery
        .order(sortColumn === "title" ? "title" : "title", { ascending: sortDirection === "asc" })
        .range(from, to);

      if (error) throw error;

      // Transform data to include platform-specific content
      const transformedData = (booksData || []).map((book: any) => {
        const platformContent = book.platform_content?.find((c: any) => c.platform === platform);
        return {
          id: platformContent?.id || `temp-${book.id}`,
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
          _hasContent: !!platformContent,
        };
      });

      // Sort by published status if needed
      if (sortColumn === "published") {
        transformedData.sort((a: any, b: any) => {
          const aVal = a.published ? 1 : 0;
          const bVal = b.published ? 1 : 0;
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        });
      }

      return { items: transformedData, totalCount: count || 0 };
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
                          platform === 'tiktok' ? 'publish-to-tiktok' :
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
    const items = contentData?.items || [];
    if (items.length === 0) {
      toast({
        title: "Brak książek",
        description: "Nie ma książek do wygenerowania tekstów AI",
        variant: "destructive",
      });
      return;
    }

    // Check platform-specific AI text from books table
    const booksWithoutAI = items.filter((c: any) => {
      const platformAiText = platform === 'x' ? c.book.ai_text_x : 
                             platform === 'facebook' ? c.book.ai_text_facebook : 
                             null;
      return !platformAiText;
    });
    
    if (booksWithoutAI.length === 0) {
      toast({
        title: "Wszystkie książki mają teksty AI",
        description: "Wszystkie książki już mają wygenerowane teksty AI dla tej platformy",
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

        // Update book table with platform-specific AI text
        const updateField = platform === 'x' ? 'ai_text_x' : 
                           platform === 'facebook' ? 'ai_text_facebook' : 
                           'ai_generated_text';
        
        const { error: updateError } = await supabase
          .from("books")
          .update({ [updateField]: data.salesText })
          .eq("id", content.book.id);

        if (updateError) throw updateError;

        // Content record is no longer needed for AI text storage

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

  const items = contentData?.items || [];
  const totalCount = contentData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const selectedBook = items.find((c: any) => c.book.id === selectedBookId)?.book;
  const selectedContent = items.find((c: any) => c.book.id === selectedBookId);

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
            {items.map((content: any) => {
              const book = content.book;
              const isPublishing = publishingIds.has(content.id);
              
              // For video-only platforms, only require video; for others require AI text from books table
              const isVideoOnlyPlatform = platformRequiresVideo(platform as PlatformId);
              const hasVideo = !!(book.video_url || book.video_storage_path);
              // Check platform-specific AI text from books table
              const platformAiText = platform === 'x' ? book.ai_text_x : 
                                     platform === 'facebook' ? book.ai_text_facebook : 
                                     null;
              const hasAiText = !!platformAiText;
              const canPublish = isVideoOnlyPlatform ? hasVideo : hasAiText;

              return (
                <TableRow key={content.id}>
                  <TableCell>
                    {(() => {
                      // Priority: storage_path (for uploaded files), then image_url
                      const imageUrl = book.storage_path 
                        ? supabase.storage.from("ObrazkiKsiazek").getPublicUrl(book.storage_path).data.publicUrl
                        : book.image_url;
                      
                      return imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-muted rounded flex items-center justify-center text-xs">
                          Brak
                        </div>
                      );
                    })()}
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSchedule(book.id, content.id)}
                        disabled={!canPublish}
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={canPublish ? "destructive" : "outline"}
                        onClick={() => handlePublish(content.id, book.id)}
                        disabled={!canPublish || isPublishing}
                        title={!canPublish ? "Najpierw wygeneruj tekst AI" : "Opublikuj"}
                      >
                        {isPublishing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
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
                        disabled={!platformAiText && !isVideoOnlyPlatform}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Strona {currentPage} z {totalPages} ({totalCount} książek)
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
