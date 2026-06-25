import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BookOpen, CheckSquare, Square, Loader2, Video } from "lucide-react";

interface Book {
  id: string;
  code: string;
  title: string;
  image_url?: string;
  storage_path?: string;
  description?: string;
  video_url?: string | null;
  video_storage_path?: string | null;
}

interface BookSelectorProps {
  selectedBooks: string[];
  onSelectionChange: (bookIds: string[]) => void;
  requireVideo?: boolean;
}

export const BookSelector = ({ selectedBooks, onSelectionChange, requireVideo = false }: BookSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: books, isLoading } = useQuery({
    queryKey: ["books-for-campaign", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("books")
        .select("id, code, title, image_url, storage_path, description, video_url, video_storage_path")
        .eq("exclude_from_campaigns", false)
        .order("code", { ascending: true });

      if (debouncedSearch.trim()) {
        query = query.or(
          `code.ilike.%${debouncedSearch}%,title.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Book[];
    },
  });

  useEffect(() => {
    if (!requireVideo || !books) return;
    const allowedIds = new Set(books.filter(hasVideo).map((book) => book.id));
    const filtered = selectedBooks.filter((id) => allowedIds.has(id));
    if (filtered.length !== selectedBooks.length) {
      onSelectionChange(filtered);
    }
  }, [requireVideo, books, selectedBooks, onSelectionChange]);

  const handleToggle = (bookId: string) => {
    const book = books?.find((b) => b.id === bookId);
    if (requireVideo && book && !hasVideo(book)) return;

    if (selectedBooks.includes(bookId)) {
      onSelectionChange(selectedBooks.filter(id => id !== bookId));
    } else {
      onSelectionChange([...selectedBooks, bookId]);
    }
  };

  const handleSelectAll = () => {
    if (books) {
      onSelectionChange(books.filter((book) => !requireVideo || hasVideo(book)).map(b => b.id));
    }
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  const hasVideo = (book: Book) => Boolean(book.video_url || book.video_storage_path);

  return (
    <Card className="p-6 bg-secondary/30">
      <div className="flex items-center gap-3 mb-4">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Wybierz książki do kampanii</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        {requireVideo
          ? "TikTok wymaga wideo — możesz zaznaczyć tylko książki z przypisanym filmem."
          : "Zaznacz książki, które mają być promowane w kampanii sprzedażowej. Posty będą generowane tylko dla wybranych pozycji."}
      </p>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Szukaj po kodzie lub tytule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSelectAll}>
          <CheckSquare className="h-4 w-4 mr-1" />
          Wszystkie
        </Button>
        <Button variant="outline" size="sm" onClick={handleDeselectAll}>
          <Square className="h-4 w-4 mr-1" />
          Odznacz
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Wybrano: <strong className="text-foreground">{selectedBooks.length}</strong> z {books?.length || 0} książek
            </span>
          </div>
          
          <ScrollArea className="h-[300px] border rounded-md">
            <div className="p-2 space-y-1">
              {books?.map((book) => {
                const bookHasVideo = hasVideo(book);
                const disabled = requireVideo && !bookHasVideo;
                return (
                <div
                  key={book.id}
                  className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  } ${
                    selectedBooks.includes(book.id) 
                      ? "bg-primary/10 border border-primary/30" 
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleToggle(book.id)}
                >
                  <Checkbox
                    checked={selectedBooks.includes(book.id)}
                    onCheckedChange={() => handleToggle(book.id)}
                    disabled={disabled}
                    className="pointer-events-none"
                  />
                  {(() => {
                    const imageUrl = book.storage_path 
                      ? supabase.storage.from("ObrazkiKsiazek").getPublicUrl(book.storage_path).data.publicUrl
                      : book.image_url;
                    
                    return imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={book.title}
                        className="w-10 h-14 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-muted rounded flex items-center justify-center text-xs">
                        Brak
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{book.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{book.code}</span>
                      {bookHasVideo && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Video className="h-3 w-3" /> wideo
                        </span>
                      )}
                      {requireVideo && !bookHasVideo && <span>brak wideo</span>}
                    </div>
                  </div>
                </div>
              );
              })}
              {books?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nie znaleziono książek
                </p>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </Card>
  );
};
