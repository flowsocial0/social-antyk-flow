import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Video, Circle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BookRecord } from "./types";
import { isValidUrl } from "./utils";

interface ManualAssignTabProps {
  allBooks: BookRecord[] | undefined;
  onDone: () => void;
}

export const ManualAssignTab = ({ allBooks, onDone }: ManualAssignTabProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [manualLinks, setManualLinks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filteredBooks = useMemo(() => {
    if (!allBooks) return [];
    if (!search.trim()) return allBooks;
    const q = search.toLowerCase();
    return allBooks.filter(b => b.title.toLowerCase().includes(q));
  }, [allBooks, search]);

  const changedCount = useMemo(() => {
    return Object.entries(manualLinks).filter(([bookId, url]) => {
      const book = allBooks?.find(b => b.id === bookId);
      return url.trim() !== "" && url !== (book?.video_url || "") && isValidUrl(url.trim());
    }).length;
  }, [manualLinks, allBooks]);

  const handleSave = async () => {
    setSaving(true);
    let success = 0;
    let errors = 0;

    const entries = Object.entries(manualLinks).filter(([bookId, url]) => {
      const book = allBooks?.find(b => b.id === bookId);
      return url.trim() !== "" && url !== (book?.video_url || "") && isValidUrl(url.trim());
    });

    for (const [bookId, url] of entries) {
      const { error } = await supabase
        .from("books")
        .update({ video_url: url.trim() })
        .eq("id", bookId);
      if (error) {
        console.error(`Failed to update book ${bookId}:`, error);
        errors++;
      } else {
        success++;
      }
    }

    setSaving(false);
    toast({
      title: `Zapisano ${success} linków`,
      description: errors > 0 ? `${errors} błędów` : undefined,
      variant: errors > 0 ? "destructive" : "default",
    });
    if (errors === 0) onDone();
  };

  if (!allBooks) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Ładowanie książek...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3 py-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj książki po tytule..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex-1 max-h-[45vh] border rounded-md overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Tytuł książki</TableHead>
              <TableHead className="min-w-[300px]">Link do wideo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBooks.map(book => {
              const currentUrl = manualLinks[book.id] ?? "";
              const hasVideo = !!(book.video_url || (currentUrl && isValidUrl(currentUrl)));
              return (
                <TableRow key={book.id}>
                  <TableCell className="px-2">
                    {book.video_url ? (
                      <Video className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/30" />
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-medium max-w-[200px]">
                    <span className="line-clamp-1" title={book.title}>{book.title}</span>
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="https://..."
                      value={currentUrl || book.video_url || ""}
                      onChange={e => setManualLinks(prev => ({ ...prev, [book.id]: e.target.value }))}
                      className="h-7 text-xs font-mono"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Wyświetlono {filteredBooks.length} z {allBooks.length} książek
      </div>

      <Button
        onClick={handleSave}
        disabled={changedCount === 0 || saving}
        className="w-full"
      >
        {saving ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Zapisywanie...</>
        ) : (
          <>Zapisz {changedCount} zmian</>
        )}
      </Button>
    </div>
  );
};
