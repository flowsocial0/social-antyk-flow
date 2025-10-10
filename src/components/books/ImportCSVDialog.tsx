import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVRow {
  Kod: string;
  Nazwa: string;
  Obrazek: string;
  "Cena sprzedaży": string;
  "Cena promocyjna": string;
  "Stan towaru": string;
  "Ilość w magazynach": string;
}

export const ImportCSVDialog = ({ open, onOpenChange }: ImportCSVDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ success: number; failed: number; total: number } | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setProgress(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Wybierz plik CSV");
      return;
    }

    setImporting(true);
    setProgress({ success: 0, failed: 0, total: 0 });

    const arrayBuffer = await file.arrayBuffer();
    const { text: csvText } = decodeWithFallback(arrayBuffer);

    Papa.parse<CSVRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Filter out items marked as "niewidoczny" and empty statuses
        const visibleItems = results.data.filter((row) => {
          const status = row["Stan towaru"]?.trim().toLowerCase();
          return !!status && status !== "niewidoczny";
        });
        const total = visibleItems.length;
        let success = 0;
        let failed = 0;

        setProgress({ success, failed, total });

        // Process in batches of 10
        const batchSize = 10;
        for (let i = 0; i < visibleItems.length; i += batchSize) {
          const batch = visibleItems.slice(i, i + batchSize);
          
          const bookData = batch.map((row) => ({
            code: row.Kod?.trim() || "",
            title: row.Nazwa?.trim() || "",
            image_url: row.Obrazek?.trim() || null,
            sale_price: parsePrice(row["Cena sprzedaży"]),
            promotional_price: parsePrice(row["Cena promocyjna"]),
            stock_status: row["Stan towaru"]?.trim() || null,
            warehouse_quantity: parseQuantity(row["Ilość w magazynach"]),
          }));

          const { data, error } = await supabase
            .from("books")
            .upsert(bookData, { 
              onConflict: "code",
              ignoreDuplicates: false 
            });

          if (error) {
            console.error("Błąd importu partii:", error);
            failed += batch.length;
          } else {
            success += batch.length;
          }

          setProgress({ success, failed, total });
        }

        setImporting(false);
        
        if (failed === 0) {
          toast.success(`Pomyślnie zaimportowano ${success} książek!`);
        } else {
          toast.warning(`Zaimportowano ${success} książek. Błędów: ${failed}`);
        }

        setTimeout(() => {
          onOpenChange(false);
          setFile(null);
          setProgress(null);
        }, 2000);
      },
      error: (error) => {
        console.error("Błąd parsowania CSV:", error);
        toast.error("Błąd podczas parsowania pliku CSV");
        setImporting(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importuj książki z CSV</DialogTitle>
          <DialogDescription>
            Wybierz plik CSV z danymi książek. Plik powinien zawierać kolumny: Kod, Nazwa, Obrazek, Cena sprzedaży, Cena promocyjna, Stan towaru, Ilość w magazynach.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-col gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={importing}
              className="cursor-pointer"
            />

            {file && !importing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>{file.name}</span>
              </div>
            )}

            {progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Postęp importu:</span>
                  <span className="font-medium">
                    {progress.success + progress.failed} / {progress.total}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${((progress.success + progress.failed) / progress.total) * 100}%`,
                    }}
                  />
                </div>
                {progress.failed > 0 && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>Błędy: {progress.failed}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={importing}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importuję..." : "Importuj"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
