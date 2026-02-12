import { useState, useMemo } from "react";
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

  const selectedTitle = allBooks.find(b => b.id === value)?.title;

  const filtered = useMemo(() => {
    if (!search.trim()) return allBooks.slice(0, 20);
    const q = search.toLowerCase();
    return allBooks.filter(b => b.title.toLowerCase().includes(q)).slice(0, 20);
  }, [allBooks, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-7 text-xs w-full justify-between font-normal truncate">
          <span className="truncate">{selectedTitle || "Wybierz książkę"}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          placeholder="Szukaj książki..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-7 text-xs mb-2"
          autoFocus
        />
        <div className="max-h-48 overflow-auto space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">Brak wyników</p>
          )}
          {filtered.map(book => (
            <button
              key={book.id}
              className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent truncate ${book.id === value ? "bg-accent font-medium" : ""}`}
              onClick={() => { onChange(book.id); setOpen(false); setSearch(""); }}
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
