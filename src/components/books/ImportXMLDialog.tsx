import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle, AlertCircle, Eye, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ImportXMLDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedBook {
  code: string;
  title: string;
  author?: string | null;
  image_url?: string | null;
  sale_price?: number | null;
  promotional_price?: number | null;
  description?: string | null;
  product_url?: string | null;
}

type ImportStep = 'select' | 'preview' | 'importing';

export const ImportXMLDialog = ({ open, onOpenChange }: ImportXMLDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<ImportStep>('select');
  const [parsedBooks, setParsedBooks] = useState<ParsedBook[]>([]);
  const [importing, setImporting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [previewStats, setPreviewStats] = useState<{ new: number; updates: number }>({ new: 0, updates: 0 });
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{
    success: number;
    failed: number;
    total: number;
    phase: string;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setStep('select');
      setFile(null);
      setParsedBooks([]);
      setProgress(null);
      setPreviewStats({ new: 0, updates: 0 });
    }
  }, [open]);

  const parsePrice = (priceStr: string | null): number | null => {
    if (!priceStr || priceStr.trim() === "") return null;
    const cleaned = priceStr.replace(",", ".");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const getElementText = (element: Element, tagName: string): string | null => {
    const el = element.getElementsByTagName(tagName)[0];
    return el?.textContent?.trim() || null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setProgress(null);

      try {
        const text = await selectedFile.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        // Check for parsing errors
        const parseError = xmlDoc.querySelector("parsererror");
        if (parseError) {
          toast.error("Błąd parsowania XML: nieprawidłowy format pliku");
          return;
        }

        // Find all book elements
        const bookElements = xmlDoc.getElementsByTagName("book");
        const books: ParsedBook[] = [];

        for (let i = 0; i < bookElements.length; i++) {
          const bookEl = bookElements[i];
          const code = getElementText(bookEl, "code");
          const title = getElementText(bookEl, "title");

          if (code && title) {
            books.push({
              code,
              title,
              author: getElementText(bookEl, "author"),
              image_url: getElementText(bookEl, "image_url"),
              sale_price: parsePrice(getElementText(bookEl, "sale_price")),
              promotional_price: parsePrice(getElementText(bookEl, "promotional_price")),
              description: getElementText(bookEl, "description"),
              product_url: getElementText(bookEl, "product_url"),
            });
          }
        }

        // Deduplicate by code
        const uniqueBooksMap = new Map<string, ParsedBook>();
        books.forEach((book) => {
          uniqueBooksMap.set(book.code, book);
        });

        const uniqueItems = Array.from(uniqueBooksMap.values());
        setParsedBooks(uniqueItems);

        // Fetch existing books for comparison
        if (user) {
          const { data: existingBooks } = await supabase
            .from("books")
            .select("code")
            .eq("user_id", user.id);

          const existingCodesSet = new Set(existingBooks?.map(b => b.code) || []);
          setExistingCodes(existingCodesSet);

          const newCount = uniqueItems.filter(b => !existingCodesSet.has(b.code)).length;
          const updateCount = uniqueItems.filter(b => existingCodesSet.has(b.code)).length;

          setPreviewStats({
            new: newCount,
            updates: updateCount,
          });
        }

        if (uniqueItems.length === 0) {
          toast.error("Nie znaleziono żadnych książek w pliku XML");
          return;
        }

        setStep('preview');
      } catch (error) {
        console.error("Błąd parsowania XML:", error);
        toast.error("Błąd podczas parsowania pliku XML");
      }
    }
  };

  const handleImport = async () => {
    if (parsedBooks.length === 0 || !user) {
      toast.error("Brak danych do importu");
      return;
    }

    setStep('importing');
    setImporting(true);
    setProgress({ success: 0, failed: 0, total: parsedBooks.length, phase: "Importowanie książek...", errors: [] });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    const total = parsedBooks.length;

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < parsedBooks.length; i += batchSize) {
      const batch = parsedBooks.slice(i, i + batchSize);

      const bookData = batch.map((book) => ({
        code: book.code,
        title: book.title,
        author: book.author,
        image_url: book.image_url,
        sale_price: book.sale_price,
        promotional_price: book.promotional_price,
        description: book.description,
        product_url: book.product_url,
        user_id: user.id,
      }));

      const { error } = await supabase.from("books").upsert(bookData, {
        onConflict: "user_id,code",
        ignoreDuplicates: false,
      });

      if (error) {
        console.error("Błąd importu partii:", error, bookData);
        failed += batch.length;
        errors.push(`Pozycje ${i + 1}-${i + batch.length}: ${error.message || "Nieznany błąd"}`);
      } else {
        success += batch.length;
      }

      setProgress({
        success,
        failed,
        total,
        phase: `Importowanie... (${success}/${total})`,
        errors: [...errors],
      });
    }

    setImporting(false);

    if (failed === 0) {
      toast.success(`Import zakończony! Dodano/zaktualizowano: ${success} książek.`);
    } else {
      toast.warning(`Import zakończony. Sukces: ${success}. Błędów: ${failed}.`);
    }

    setTimeout(() => {
      onOpenChange(false);
    }, 2000);
  };

  const renderSelectStep = () => (
    <div className="space-y-4 py-4">
      <div className="flex flex-col gap-4">
        <Input
          type="file"
          accept=".xml"
          onChange={handleFileChange}
          disabled={importing}
          className="cursor-pointer"
        />

        {file && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-success" />
            <span>{file.name}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4 py-4">
      {/* Stats summary */}
      <div className="flex gap-4 flex-wrap">
        <Badge variant="default" className="text-sm">
          <span className="mr-1">Nowych:</span> {previewStats.new}
        </Badge>
        <Badge variant="secondary" className="text-sm">
          <span className="mr-1">Aktualizacji:</span> {previewStats.updates}
        </Badge>
      </div>

      {/* Preview table */}
      <ScrollArea className="h-[300px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Kod</TableHead>
              <TableHead>Tytuł</TableHead>
              <TableHead className="w-[100px]">Cena</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedBooks.slice(0, 50).map((book, index) => (
              <TableRow key={index}>
                <TableCell className="font-mono text-xs">{book.code}</TableCell>
                <TableCell className="max-w-[200px] truncate">{book.title}</TableCell>
                <TableCell>
                  {book.promotional_price ? (
                    <span className="text-green-600">{book.promotional_price} zł</span>
                  ) : book.sale_price ? (
                    <span>{book.sale_price} zł</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {existingCodes.has(book.code) ? (
                    <Badge variant="outline" className="text-xs">Aktualizacja</Badge>
                  ) : (
                    <Badge variant="default" className="text-xs">Nowy</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {parsedBooks.length > 50 && (
        <p className="text-xs text-muted-foreground text-center">
          Pokazano 50 z {parsedBooks.length} pozycji
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep('select')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Wróć
        </Button>
        <Button onClick={handleImport}>
          <Upload className="h-4 w-4 mr-2" />
          Importuj {parsedBooks.length} pozycji
        </Button>
      </div>
    </div>
  );

  const renderImportingStep = () => (
    <div className="space-y-4 py-4">
      {progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{progress.phase}</span>
            {progress.total > 0 && (
              <span className="font-medium">
                {progress.success + progress.failed} / {progress.total}
              </span>
            )}
          </div>
          {progress.total > 0 && (
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${((progress.success + progress.failed) / progress.total) * 100}%`,
                }}
              />
            </div>
          )}
          {progress.failed > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Błędy: {progress.failed}</span>
              </div>
              {progress.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto text-xs bg-destructive/10 rounded p-2 space-y-1">
                  {progress.errors.map((err, i) => (
                    <div key={i} className="text-destructive">
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'preview' && <Eye className="h-5 w-5" />}
            {step === 'select' && "Importuj książki z XML"}
            {step === 'preview' && "Podgląd importu"}
            {step === 'importing' && "Importowanie..."}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && (
              <>
                Wybierz plik XML z danymi książek. Wymagana struktura:
                <br />
                <code className="text-xs bg-muted px-1 rounded">
                  &lt;books&gt;&lt;book&gt;&lt;code&gt;...&lt;/code&gt;&lt;title&gt;...&lt;/title&gt;&lt;/book&gt;&lt;/books&gt;
                </code>
              </>
            )}
            {step === 'preview' && "Sprawdź dane przed importem."}
            {step === 'importing' && "Trwa import książek do bazy danych..."}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && renderSelectStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'importing' && renderImportingStep()}
      </DialogContent>
    </Dialog>
  );
};
