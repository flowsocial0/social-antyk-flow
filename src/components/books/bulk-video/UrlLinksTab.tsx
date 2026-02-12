import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Link } from "lucide-react";
import { FileMatch, BookRecord } from "./types";
import { normalize, similarity, extractFilenameFromUrl, isValidUrl } from "./utils";

interface UrlLinksTabProps {
  allBooks: BookRecord[] | undefined;
  onMatchesReady: (matches: FileMatch[]) => void;
}

export const UrlLinksTab = ({ allBooks, onMatchesReady }: UrlLinksTabProps) => {
  const [urlText, setUrlText] = useState("");

  const parseAndMatch = () => {
    if (!allBooks) return;
    const lines = urlText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && isValidUrl(l));

    // deduplicate
    const uniqueUrls = [...new Set(lines)];

    const booksList = allBooks.map(b => ({ ...b, normalizedTitle: normalize(b.title) }));

    const matched: FileMatch[] = uniqueUrls.map(url => {
      const filename = extractFilenameFromUrl(url);
      const normalizedName = normalize(filename);
      let bestSim = 0;
      let bestBook: typeof booksList[0] | null = null;

      for (const book of booksList) {
        const sim = similarity(normalizedName, book.normalizedTitle);
        if (sim > bestSim) {
          bestSim = sim;
          bestBook = book;
        }
      }

      if (bestSim >= 0.7 && bestBook) {
        return { url, fileName: filename, bookId: bestBook.id, bookTitle: bestBook.title, similarity: bestSim, status: "matched" as const };
      } else if (bestSim >= 0.4 && bestBook) {
        return { url, fileName: filename, bookId: bestBook.id, bookTitle: bestBook.title, similarity: bestSim, status: "partial" as const };
      } else {
        return { url, fileName: filename, bookId: null, bookTitle: null, similarity: bestSim, status: "unmatched" as const };
      }
    });

    onMatchesReady(matched);
  };

  const urlCount = urlText
    .split("\n")
    .filter(l => l.trim() && isValidUrl(l.trim())).length;

  return (
    <div className="space-y-4 py-4">
      <Textarea
        placeholder={"Wklej linki do filmów (jeden na linię):\nhttps://serwer.pl/filmy/Ogniem-i-Mieczem.mp4\nhttps://serwer.pl/filmy/Pan-Tadeusz.mp4"}
        value={urlText}
        onChange={e => setUrlText(e.target.value)}
        className="min-h-[160px] font-mono text-xs"
      />
      {urlCount > 0 && (
        <div className="text-sm text-muted-foreground">
          Rozpoznano <strong>{urlCount}</strong> poprawnych linków
        </div>
      )}
      <Button
        onClick={parseAndMatch}
        disabled={urlCount === 0 || !allBooks}
        className="w-full"
      >
        {!allBooks ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ładowanie książek...</>
        ) : (
          <><Link className="mr-2 h-4 w-4" />Dalej – dopasuj do książek</>
        )}
      </Button>
    </div>
  );
};
