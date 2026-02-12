import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Cloud } from "lucide-react";
import { FileMatch, BookRecord } from "./types";
import { isMegaUrl, normalize, similarity } from "./utils";
import { File as MegaFile } from "megajs";

interface MegaLinksTabProps {
  allBooks: BookRecord[] | undefined;
  onMatchesReady: (matches: FileMatch[]) => void;
}

interface MegaFileInfo {
  url: string;
  megaFile: any;
  fileName: string;
  size: number;
}

export const MegaLinksTab = ({ allBooks, onMatchesReady }: MegaLinksTabProps) => {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const validLinks = lines.filter(isMegaUrl);
  const invalidLinks = lines.filter((l) => !isMegaUrl(l));

  const handleNext = async () => {
    if (!allBooks || validLinks.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      // Load attributes for all mega files
      const megaFiles: MegaFileInfo[] = [];
      const errors: string[] = [];

      for (const url of validLinks) {
        try {
          const file = MegaFile.fromURL(url);
          await file.loadAttributes();
          megaFiles.push({
            url,
            megaFile: file,
            fileName: file.name || "unknown",
            size: file.size || 0,
          });
        } catch (err: any) {
          errors.push(`${url.substring(0, 50)}... — ${err.message || "Błąd ładowania"}`);
        }
      }

      if (errors.length > 0 && megaFiles.length === 0) {
        setError(`Nie udało się załadować żadnego pliku:\n${errors.join("\n")}`);
        setLoading(false);
        return;
      }

      // Total size warning
      const totalSize = megaFiles.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > 1024 * 1024 * 1024) {
        const gb = (totalSize / (1024 * 1024 * 1024)).toFixed(1);
        setError(
          `Łączny rozmiar plików: ${gb} GB. Duże pliki mogą zająć dużo pamięci RAM przeglądarki. Kontynuuję mimo to...`
        );
      }

      // Match to books using LCS
      const booksList = allBooks.map((b) => ({
        ...b,
        normalizedTitle: normalize(b.title),
      }));

      const matches: FileMatch[] = megaFiles.map((mf) => {
        const normalizedName = normalize(mf.fileName);
        let bestSim = 0;
        let bestBook: (typeof booksList)[0] | null = null;

        for (const book of booksList) {
          const sim = similarity(normalizedName, book.normalizedTitle);
          if (sim > bestSim) {
            bestSim = sim;
            bestBook = book;
          }
        }

        if (bestSim >= 0.7 && bestBook) {
          return {
            fileName: mf.fileName,
            url: mf.url,
            megaFile: mf.megaFile,
            bookId: bestBook.id,
            bookTitle: bestBook.title,
            similarity: bestSim,
            status: "matched" as const,
          };
        }
        if (bestSim >= 0.4 && bestBook) {
          return {
            fileName: mf.fileName,
            url: mf.url,
            megaFile: mf.megaFile,
            bookId: bestBook.id,
            bookTitle: bestBook.title,
            similarity: bestSim,
            status: "partial" as const,
          };
        }
        return {
          fileName: mf.fileName,
          url: mf.url,
          megaFile: mf.megaFile,
          bookId: null,
          bookTitle: null,
          similarity: bestSim,
          status: "unmatched" as const,
        };
      });

      if (errors.length > 0) {
        setError(`Załadowano ${megaFiles.length} plików, ${errors.length} błędów.`);
      }

      onMatchesReady(matches);
    } catch (err: any) {
      setError(err.message || "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 py-4 flex flex-col">
      <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-xs text-muted-foreground">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
        <div>
          <p className="font-medium text-foreground">Informacja o pamięci</p>
          <p>
            Pliki z Mega.nz są deszyfrowane w przeglądarce. Duże pliki wideo mogą
            zająć dużo pamięci RAM. Zalecane dla plików do ~500 MB każdy.
          </p>
        </div>
      </div>

      <Textarea
        placeholder={
          "Wklej linki Mega.nz (jeden na linię):\nhttps://mega.nz/file/ABC123#key...\nhttps://mega.nz/file/DEF456#key..."
        }
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={8}
        className="font-mono text-xs"
      />

      {lines.length > 0 && (
        <div className="flex gap-2 text-xs">
          <Badge variant="default" className="bg-green-600">
            <Cloud className="mr-1 h-3 w-3" />
            Poprawne: {validLinks.length}
          </Badge>
          {invalidLinks.length > 0 && (
            <Badge variant="destructive">Niepoprawne: {invalidLinks.length}</Badge>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-md whitespace-pre-wrap">
          {error}
        </div>
      )}

      <Button
        onClick={handleNext}
        disabled={validLinks.length === 0 || !allBooks || loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Ładowanie plików z Mega ({validLinks.length})...
          </>
        ) : !allBooks ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Ładowanie książek...
          </>
        ) : (
          <>Dalej – pobierz nazwy i dopasuj ({validLinks.length})</>
        )}
      </Button>
    </div>
  );
};
