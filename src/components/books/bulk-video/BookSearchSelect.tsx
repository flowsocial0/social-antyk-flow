import { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown } from "lucide-react";
import { BookRecord } from "./types";

interface BookSearchSelectProps {
  allBooks: BookRecord[];
  value: string;
  onChange: (bookId: string) => void;
}

export const BookSearchSelect = ({ allBooks, value, onChange }: BookSearchSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedTitle = allBooks.find(b => b.id === value)?.title;

  const filtered = useMemo(() => {
    if (!search.trim()) return allBooks.slice(0, 20);
    const q = search.toLowerCase();
    return allBooks.filter(b => b.title.toLowerCase().includes(q)).slice(0, 20);
  }, [allBooks, search]);

  // Reset highlight when search changes
  useEffect(() => { setHighlightIndex(0); }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      const book = filtered[highlightIndex];
      if (book) { onChange(book.id); setOpen(false); setSearch(""); }
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const el = container.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-7 text-xs w-full justify-between font-normal truncate">
          <span className="truncate">{selectedTitle || "Wybierz książkę"}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start" onOpenAutoFocus={e => e.preventDefault()}>
        <Input
          placeholder="Szukaj książki..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-xs mb-2"
          autoFocus
        />
        <div ref={listRef} className="max-h-48 overflow-auto space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">Brak wyników</p>
          )}
          {filtered.map((book, i) => (
            <button
              key={book.id}
              className={`w-full text-left text-xs px-2 py-1.5 rounded truncate ${i === highlightIndex ? "bg-accent font-medium" : "hover:bg-accent"} ${book.id === value ? "ring-1 ring-primary" : ""}`}
              onClick={() => { onChange(book.id); setOpen(false); setSearch(""); }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {book.title}
            </button>
          ))}
          {filtered.length === 20 && (
            <p className="text-xs text-muted-foreground px-2 py-1 italic">Wpisz więcej, by zawęzić...</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
