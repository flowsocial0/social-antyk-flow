import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Send, Calendar, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ScheduleDialog } from "./ScheduleDialog";
import { BulkScheduleDialog } from "./BulkScheduleDialog";

export const BooksList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [oauthState, setOauthState] = useState<{ codeVerifier?: string; state?: string }>({});

  const { data: books, isLoading } = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("publish-to-x", {
        body: { testConnection: true },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Połączenie działa!",
        description: `Zalogowano jako: ${data.user?.username || data.user?.name || "użytkownik"}`,
      });
    },
    onError: (error: any) => {
      const message = error.message || "Sprawdź swoje klucze API i uprawnienia w X";
      toast({
        title: "❌ Błąd połączenia",
        description: message.includes("No Twitter access token")
          ? "Najpierw autoryzuj aplikację klikając 'Autoryzuj Twitter'"
          : message,
        variant: "destructive",
      });
    },
  });

  const authorizeTwitterMutation = useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/twitter-callback`;
      const { data, error } = await supabase.functions.invoke("twitter-oauth-start", {
        body: { redirectUri },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Store PKCE parameters
      setOauthState({
        codeVerifier: data.codeVerifier,
        state: data.state,
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
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ bookId, bookIds }: { bookId?: string; bookIds?: string[] }) => {
      const { data, error } = await supabase.functions.invoke("publish-to-x", {
        body: { bookId, bookIds },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });

      const { summary } = data;
      if (summary.successful > 0) {
        toast({
          title: "Opublikowano pomyślnie",
          description: `${summary.successful} książek opublikowano na X`,
        });
      }
      if (summary.failed > 0) {
        toast({
          title: "Błąd publikacji",
          description: `${summary.failed} książek nie udało się opublikować`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Publish error:", error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się opublikować",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setPublishingIds(new Set());
    },
  });

  const handlePublishSingle = async (bookId: string) => {
    setPublishingIds((prev) => new Set(prev).add(bookId));
    publishMutation.mutate({ bookId });
  };

  const handlePublishAll = async () => {
    const unpublishedBooks = books?.filter((book) => !book.published) || [];
    if (unpublishedBooks.length === 0) {
      toast({
        title: "Brak książek",
        description: "Wszystkie książki są już opublikowane",
      });
      return;
    }

    const bookIds = unpublishedBooks.map((book) => book.id);
    setPublishingIds(new Set(bookIds));
    publishMutation.mutate({ bookIds });
  };

  const schedulePublishMutation = useMutation({
    mutationFn: async ({ 
      bookId, 
      scheduledAt, 
      autoPublishEnabled 
    }: { 
      bookId: string; 
      scheduledAt: string | null; 
      autoPublishEnabled: boolean 
    }) => {
      const { error } = await supabase
        .from("books")
        .update({ 
          scheduled_publish_at: scheduledAt,
          auto_publish_enabled: autoPublishEnabled 
        })
        .eq("id", bookId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast({
        title: "Zapisano",
        description: "Harmonogram publikacji został zaktualizowany",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać harmonogramu",
        variant: "destructive",
      });
    },
  });

  const bulkScheduleMutation = useMutation({
    mutationFn: async ({ intervalMinutes }: { intervalMinutes: number }) => {
      const unpublishedBooks = books?.filter((book) => !book.published) || [];
      
      // Schedule each book with increasing time intervals
      const updates = unpublishedBooks.map((book, index) => {
        const scheduledAt = new Date();
        scheduledAt.setMinutes(scheduledAt.getMinutes() + (intervalMinutes * index));
        
        return supabase
          .from("books")
          .update({
            scheduled_publish_at: scheduledAt.toISOString(),
            auto_publish_enabled: true
          })
          .eq("id", book.id);
      });

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        throw new Error(`Nie udało się zaplanować ${errors.length} książek`);
      }

      return unpublishedBooks.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast({
        title: "✅ Zaplanowano publikacje",
        description: `${count} książek zostanie opublikowanych automatycznie`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaplanować publikacji",
        variant: "destructive",
      });
    },
  });

  const handleScheduleChange = (bookId: string, scheduledAt: string | null, autoPublishEnabled: boolean) => {
    schedulePublishMutation.mutate({ bookId, scheduledAt, autoPublishEnabled });
  };

  const handleBulkSchedule = (intervalMinutes: number) => {
    bulkScheduleMutation.mutate({ intervalMinutes });
  };

  const unpublishedCount = books?.filter((book) => !book.published).length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Lista książek</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => authorizeTwitterMutation.mutate()}
            disabled={authorizeTwitterMutation.isPending}
            size="sm"
          >
            {authorizeTwitterMutation.isPending ? "Przekierowywanie..." : "🔑 Zaloguj"}
          </Button>
          <Button
            variant="outline"
            onClick={() => testConnectionMutation.mutate()}
            disabled={testConnectionMutation.isPending}
            size="sm"
          >
            {testConnectionMutation.isPending ? "Testowanie..." : "🔍 Test połączenia"}
          </Button>
          <BulkScheduleDialog
            unpublishedCount={unpublishedCount}
            onSchedule={handleBulkSchedule}
            isScheduling={bulkScheduleMutation.isPending}
          />
          {unpublishedCount > 0 && (
            <Button onClick={handlePublishAll} disabled={publishMutation.isPending} size="sm">
              <Send className="mr-2 h-4 w-4" />
              Teraz wszystkie ({unpublishedCount})
            </Button>
          )}
        </div>
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
                  <TableHead>Harmonogram</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {books && books.length > 0 ? (
                  books.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell className="font-medium">{book.code}</TableCell>
                      <TableCell className="max-w-md truncate">{book.title}</TableCell>
                      <TableCell>{book.stock_status || "-"}</TableCell>
                      <TableCell>{book.sale_price ? `${book.sale_price} zł` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={book.published ? "default" : "secondary"}>
                          {book.published ? "Opublikowano" : "Nieopublikowano"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!book.published && (
                          <ScheduleDialog
                            book={book}
                            onScheduleChange={handleScheduleChange}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!book.published && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePublishSingle(book.id)}
                            disabled={publishingIds.has(book.id)}
                          >
                            {publishingIds.has(book.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Opublikuj
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
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
