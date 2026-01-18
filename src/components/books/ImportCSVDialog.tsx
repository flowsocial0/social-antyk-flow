import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle, AlertCircle, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVRow {
  Kod: string;
  Nazwa: string;
  Autor?: string;
  Obrazek: string;
  "Cena sprzedaży": string;
  "Cena promocyjna": string;
  "Stan towaru": string;
  "Ilość w magazynach": string;
  // English headers support
  code?: string;
  title?: string;
  image_url?: string;
  sale_price?: string;
  promotional_price?: string;
  description?: string;
  product_url?: string;
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
  stock_status?: string | null;
  warehouse_quantity?: number | null;
}

type ImportStep = 'select' | 'preview' | 'importing';

export const ImportCSVDialog = ({ open, onOpenChange }: ImportCSVDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<ImportStep>('select');
  const [parsedBooks, setParsedBooks] = useState<ParsedBook[]>([]);
  const [importing, setImporting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [previewStats, setPreviewStats] = useState<{ new: number; updates: number; deletes: number }>({ new: 0, updates: 0, deletes: 0 });
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
      setPreviewStats({ new: 0, updates: 0, deletes: 0 });
    }
  }, [open]);

  const parsePrice = (priceStr: string): number | null => {
    if (!priceStr || priceStr.trim() === "") return null;
    const cleaned = priceStr.replace(",", ".");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const parseQuantity = (qtyStr: string): number | null => {
    if (!qtyStr || qtyStr.trim() === "") return null;
    const parsed = parseInt(qtyStr);
    return isNaN(parsed) ? null : parsed;
  };

  // Decode CSV with fallback to common Polish encodings
  const decodeWithFallback = (buffer: ArrayBuffer) => {
    const encodings = ["utf-8", "windows-1250", "iso-8859-2"] as const;
    let bestText = "";
    let bestEnc: string = encodings[0];
    let lowestRepl = Number.POSITIVE_INFINITY;
    for (const enc of encodings) {
      try {
        const decoder = new TextDecoder(enc as unknown as string, { fatal: false });
        const text = decoder.decode(new Uint8Array(buffer));
        const repl = (text.match(/\uFFFD/g) ?? []).length;
        if (repl < lowestRepl) {
          lowestRepl = repl;
          bestText = text;
          bestEnc = enc as unknown as string;
        }
      } catch {
        // ignore decoding errors and try next encoding
      }
    }
    return { text: bestText, encoding: bestEnc };
  };

  // Detect delimiter (TAB vs comma)
  const detectDelimiter = (text: string): string => {
    const firstLine = text.split('\n')[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    return tabCount > commaCount ? '\t' : ',';
  };

  // Normalize row - map English headers to Polish
  const normalizeRow = (row: CSVRow): ParsedBook => {
    const code = (row.Kod || row.code || '').trim();
    const title = (row.Nazwa || row.title || '').trim();
    const author = row.Autor?.trim() || null;
    const image_url = (row.Obrazek || row.image_url || '').trim() || null;
    const sale_price = parsePrice(row["Cena sprzedaży"] || row.sale_price || '');
    const promotional_price = parsePrice(row["Cena promocyjna"] || row.promotional_price || '');
    const description = row.description?.trim() || null;
    const product_url = row.product_url?.trim() || null;
    const stock_status = row["Stan towaru"]?.trim() || null;
    const warehouse_quantity = parseQuantity(row["Ilość w magazynach"] || '');

    return {
      code,
      title,
      author,
      image_url,
      sale_price,
      promotional_price,
      description,
      product_url,
      stock_status,
      warehouse_quantity,
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setProgress(null);

      // Parse and preview
      const arrayBuffer = await selectedFile.arrayBuffer();
      const { text: rawCsvText } = decodeWithFallback(arrayBuffer);
      const delimiter = detectDelimiter(rawCsvText);
      
      console.log(`Detected delimiter: "${delimiter === '\t' ? 'TAB' : 'comma'}"`);

      // Clean CSV - find the header row
      const lines = rawCsvText.split("\n");
      let headerIndex = 0;
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].toLowerCase();
        if ((line.includes("kod") && line.includes("nazwa")) || 
            (line.includes("code") && line.includes("title"))) {
          headerIndex = i;
          break;
        }
      }
      const csvText = lines.slice(headerIndex).join("\n");

      Papa.parse<CSVRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        transformHeader: (header) => header.trim(),
        complete: async (results) => {
          console.log("CSV headers:", results.meta.fields);
          console.log("First row sample:", results.data[0]);

          // Filter and normalize
          const validItems = results.data
            .filter((row) => {
              const code = (row.Kod || row.code || '').trim();
              return !!code;
            })
            .map(normalizeRow);

          // Deduplicate by code
          const uniqueBooksMap = new Map<string, ParsedBook>();
          validItems.forEach((book) => {
            if (book.code) {
              uniqueBooksMap.set(book.code, book);
            }
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

            const csvCodes = new Set(uniqueItems.map(b => b.code));
            const newCount = uniqueItems.filter(b => !existingCodesSet.has(b.code)).length;
            const updateCount = uniqueItems.filter(b => existingCodesSet.has(b.code)).length;
            const deleteCount = Array.from(existingCodesSet).filter(code => !csvCodes.has(code)).length;

            setPreviewStats({
              new: newCount,
              updates: updateCount,
              deletes: deleteCount,
            });
          }

          setStep('preview');
        },
        error: (error) => {
          console.error("Błąd parsowania CSV:", error);
          toast.error("Błąd podczas parsowania pliku CSV");
        },
      });
    }
  };

  const migrateImagesToStorage = async (
    onProgress: (stats: { succeeded: number; failed: number; remaining: number }) => void,
  ) => {
    let totalSucceeded = 0;
    let totalFailed = 0;
    let hasMore = true;
    let consecutiveErrors = 0;
    const maxRetries = 3;

    while (hasMore) {
      try {
        const { data, error } = await supabase.functions.invoke("migrate-images-to-storage");

        if (error) {
          console.error("Error migrating images:", error);
          consecutiveErrors++;

          if (consecutiveErrors < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }

          return { success: false, error, stats: { succeeded: totalSucceeded, failed: totalFailed } };
        }

        consecutiveErrors = 0;

        if (data?.stats) {
          totalSucceeded += data.stats.succeeded;
          totalFailed += data.stats.failed;
          onProgress({
            succeeded: totalSucceeded,
            failed: totalFailed,
            remaining: data.stats.remaining || 0,
          });
        }

        hasMore = data?.hasMore === true;

        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error("Error calling migrate-images-to-storage:", err);
        consecutiveErrors++;

        if (consecutiveErrors < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }

        return { success: false, error: err, stats: { succeeded: totalSucceeded, failed: totalFailed } };
      }
    }

    return { success: true, stats: { succeeded: totalSucceeded, failed: totalFailed } };
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
    let deleted = 0;
    const errors: string[] = [];
    const total = parsedBooks.length;

    // Fetch all existing books for image change detection
    const { data: existingBooks } = await supabase
      .from("books")
      .select("id, code, image_url")
      .eq("user_id", user.id);

    const existingBooksMap = new Map<string, { id: string; image_url: string | null }>();
    existingBooks?.forEach((b) => {
      if (b.code) {
        existingBooksMap.set(b.code.trim(), { id: b.id, image_url: b.image_url });
      }
    });

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < parsedBooks.length; i += batchSize) {
      const batch = parsedBooks.slice(i, i + batchSize);

      const bookData = batch.map((book) => {
        const isHidden = book.stock_status?.toLowerCase() === "niewidoczny";
        const existingBook = existingBooksMap.get(book.code);
        const imageUrlChanged = existingBook ? existingBook.image_url !== book.image_url : false;

        return {
          code: book.code,
          title: book.title,
          author: book.author,
          image_url: book.image_url,
          sale_price: book.sale_price,
          promotional_price: book.promotional_price,
          description: book.description,
          product_url: book.product_url,
          stock_status: book.stock_status,
          warehouse_quantity: book.warehouse_quantity,
          exclude_from_campaigns: isHidden,
          user_id: user.id,
          ...(imageUrlChanged ? { storage_path: null } : {}),
        };
      });

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

    // Delete books not in CSV
    if (success > 0 && existingBooks && existingBooks.length > 0) {
      setProgress({ success, failed, total, phase: "Usuwanie nieaktualnych książek...", errors: [...errors] });

      const csvCodes = new Set(parsedBooks.map(b => b.code));
      const booksToDelete = existingBooks.filter((book) => {
        const bookCode = book.code?.trim();
        return bookCode ? !csvCodes.has(bookCode) : false;
      });

      if (booksToDelete.length > 0) {
        const deleteIds = booksToDelete.map((b) => b.id);
        for (let i = 0; i < deleteIds.length; i += 50) {
          const batchIds = deleteIds.slice(i, i + 50);
          const { error: deleteError } = await supabase.from("books").delete().in("id", batchIds);

          if (deleteError) {
            console.error("Błąd usuwania książek:", deleteError);
            errors.push(`Błąd usuwania książek: ${deleteError.message}`);
          } else {
            deleted += batchIds.length;
          }
        }
      }
    }

    // Migrate images
    setProgress({ success, failed, total, phase: "Migrowanie okładek do storage...", errors: [...errors] });

    const migrationResult = await migrateImagesToStorage((stats) => {
      setProgress({
        success,
        failed,
        total,
        phase: `Migrowanie okładek... (${stats.succeeded} przesłanych${stats.remaining > 0 ? `, pozostało: ${stats.remaining}` : ""})`,
        errors: [...errors],
      });
    });

    setImporting(false);

    const imageStats = migrationResult?.stats;
    const deletedMsg = deleted > 0 ? ` Usunięto: ${deleted}.` : "";
    const imageMsg = imageStats ? ` Okładki: ${imageStats.succeeded} przesłanych.` : "";

    if (failed === 0) {
      toast.success(`Import zakończony! Zaktualizowano: ${success}.${deletedMsg}${imageMsg}`);
    } else {
      toast.warning(`Import zakończony. Zaktualizowano: ${success}. Błędów: ${failed}.${deletedMsg}`);
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
          accept=".csv"
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
        {previewStats.deletes > 0 && (
          <Badge variant="destructive" className="text-sm">
            <span className="mr-1">Do usunięcia:</span> {previewStats.deletes}
          </Badge>
        )}
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
            {step === 'select' && "Importuj książki z CSV"}
            {step === 'preview' && "Podgląd importu"}
            {step === 'importing' && "Importowanie..."}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && (
              <>
                Wybierz plik CSV z danymi książek. Obsługiwane formaty:
                <br />
                <span className="text-xs">
                  • TAB: Kod, Nazwa, Autor, Obrazek, Cena sprzedaży, Cena promocyjna, Stan towaru
                  <br />
                  • CSV: code, title, image_url, sale_price, promotional_price, description, product_url
                </span>
              </>
            )}
            {step === 'preview' && "Sprawdź dane przed importem. Książki o tych samych kodach zostaną zaktualizowane."}
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
