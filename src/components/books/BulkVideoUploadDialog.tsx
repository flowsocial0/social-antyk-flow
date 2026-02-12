import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, CheckCircle, AlertTriangle, XCircle, Loader2, Link, PenLine, Cloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileMatch, UploadResult, BookRecord } from "./bulk-video/types";
import { normalize, similarity, formatSize } from "./bulk-video/utils";
import { UrlLinksTab } from "./bulk-video/UrlLinksTab";
import { ManualAssignTab } from "./bulk-video/ManualAssignTab";
import { MegaLinksTab } from "./bulk-video/MegaLinksTab";

interface BulkVideoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "upload" | "urls" | "manual" | "mega";

export const BulkVideoUploadDialog = ({ open, onOpenChange }: BulkVideoUploadDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("upload");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploadDone, setUploadDone] = useState(false);
  const [megaPhase, setMegaPhase] = useState<string>("");
  const abortRef = useRef(false);

  const { data: allBooks } = useQuery({
    queryKey: ["all-books-for-matching"],
    queryFn: async () => {
      let all: BookRecord[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("books")
          .select("id, title, code, video_url")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all = all.concat((data || []) as BookRecord[]);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    enabled: open,
  });

  // --- File upload mode handlers ---
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files || []));
  };

  const totalSize = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);

  const performFileMatching = () => {
    if (!allBooks || files.length === 0) return;
    const booksList = allBooks.map(b => ({ ...b, normalizedTitle: normalize(b.title) }));
    const matched: FileMatch[] = files.map(file => {
      const normalizedName = normalize(file.name);
      let bestSim = 0;
      let bestBook: typeof booksList[0] | null = null;
      for (const book of booksList) {
        const sim = similarity(normalizedName, book.normalizedTitle);
        if (sim > bestSim) { bestSim = sim; bestBook = book; }
      }
      if (bestSim >= 0.7 && bestBook) return { file, fileName: file.name, bookId: bestBook.id, bookTitle: bestBook.title, similarity: bestSim, status: "matched" as const };
      if (bestSim >= 0.4 && bestBook) return { file, fileName: file.name, bookId: bestBook.id, bookTitle: bestBook.title, similarity: bestSim, status: "partial" as const };
      return { file, fileName: file.name, bookId: null, bookTitle: null, similarity: bestSim, status: "unmatched" as const };
    });
    setMatches(matched);
    setStep(2);
  };

  // --- URL mode: receive matches from UrlLinksTab ---
  const handleUrlMatchesReady = (m: FileMatch[]) => {
    setMode("urls");
    setMatches(m);
    setStep(2);
  };

  // --- Mega mode: receive matches from MegaLinksTab ---
  const handleMegaMatchesReady = (m: FileMatch[]) => {
    setMode("mega");
    setMatches(m);
    setStep(2);
  };

  // --- Shared match editing ---
  const updateMatch = (index: number, bookId: string) => {
    const book = allBooks?.find(b => b.id === bookId);
    if (!book) return;
    setMatches(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], bookId: book.id, bookTitle: book.title, similarity: 1, status: "matched" };
      return updated;
    });
  };

  const validMatches = matches.filter(m => m.bookId);

  // --- Save logic ---
  const startSave = async () => {
    if (mode === "urls") {
      // URL mode: instant DB update, no file upload
      setStep(3);
      setUploading(true);
      setUploadDone(false);
      setResults([]);
      const newResults: UploadResult[] = [];

      for (const match of validMatches) {
        const { error } = await supabase
          .from("books")
          .update({ video_url: match.url })
          .eq("id", match.bookId!);
        newResults.push({
          fileName: match.fileName,
          success: !error,
          error: error?.message,
        });
      }

      setResults(newResults);
      setUploading(false);
      setUploadDone(true);
      queryClient.invalidateQueries({ queryKey: ["all-books-for-matching"] });
      return;
    }

    if (mode === "mega") {
      // Mega mode: save Mega URL as video_url (no download/upload to Storage)
      setStep(3);
      setUploading(true);
      setUploadDone(false);
      setResults([]);
      const newResults: UploadResult[] = [];

      for (const match of validMatches) {
        const { error } = await supabase
          .from("books")
          .update({ video_url: match.url })
          .eq("id", match.bookId!);
        newResults.push({
          fileName: match.fileName,
          success: !error,
          error: error?.message,
        });
      }

      setResults(newResults);
      setUploading(false);
      setUploadDone(true);
      queryClient.invalidateQueries({ queryKey: ["all-books-for-matching"] });
      return;
    }

    // File upload mode
    setStep(3);
    setUploading(true);
    setUploadDone(false);
    setResults([]);
    setUploadIndex(0);
    abortRef.current = false;

    const toUpload = validMatches;
    const newResults: UploadResult[] = [];

    for (let i = 0; i < toUpload.length; i++) {
      if (abortRef.current) break;
      setUploadIndex(i);
      const match = toUpload[i];
      const ext = match.fileName.split(".").pop() || "mp4";
      const storagePath = `videos/${match.bookId}.${ext}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from("ObrazkiKsiazek")
          .upload(storagePath, match.file!, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("ObrazkiKsiazek")
          .getPublicUrl(storagePath);

        const { error: updateError } = await supabase
          .from("books")
          .update({ video_storage_path: storagePath, video_url: urlData.publicUrl })
          .eq("id", match.bookId!);
        if (updateError) throw updateError;

        newResults.push({ fileName: match.fileName, success: true });
      } catch (err: any) {
        console.error(`Upload failed for ${match.fileName}:`, err);
        newResults.push({ fileName: match.fileName, success: false, error: err.message });
      }
      setResults([...newResults]);
    }

    setUploading(false);
    setUploadDone(true);
    queryClient.invalidateQueries({ queryKey: ["all-books-for-matching"] });
  };

  const stats = useMemo(() => ({
    matched: matches.filter(m => m.status === "matched").length,
    partial: matches.filter(m => m.status === "partial").length,
    unmatched: matches.filter(m => m.status === "unmatched").length,
  }), [matches]);

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  const resetDialog = () => {
    setStep(1);
    setMode("upload");
    setFiles([]);
    setMatches([]);
    setResults([]);
    setUploadDone(false);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) { abortRef.current = true; resetDialog(); }
    onOpenChange(v);
  };

  const handleManualDone = () => {
    queryClient.invalidateQueries({ queryKey: ["all-books-for-matching"] });
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Masowy upload wideo
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Wybierz sposób dodania wideo do książek"}
            {step === 2 && "Sprawdź dopasowania i popraw ręcznie jeśli trzeba"}
            {step === 3 && (uploadDone ? "Zapisywanie zakończone" : "Trwa zapisywanie...")}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Choose mode */}
        {step === 1 && (
          <Tabs value={mode} onValueChange={v => setMode(v as Mode)} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upload" className="text-xs gap-1"><Upload className="h-3.5 w-3.5" />Upload plików</TabsTrigger>
              <TabsTrigger value="urls" className="text-xs gap-1"><Link className="h-3.5 w-3.5" />Linki URL</TabsTrigger>
              <TabsTrigger value="mega" className="text-xs gap-1"><Cloud className="h-3.5 w-3.5" />Mega.nz</TabsTrigger>
              <TabsTrigger value="manual" className="text-xs gap-1"><PenLine className="h-3.5 w-3.5" />Przypisz ręcznie</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 py-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*"
                onChange={handleFilesSelected}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              {files.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Wybrano <strong>{files.length}</strong> plików ({formatSize(totalSize)})
                </div>
              )}
              <Button onClick={performFileMatching} disabled={files.length === 0 || !allBooks} className="w-full">
                {!allBooks ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ładowanie książek...</> : <>Dalej – dopasuj do książek</>}
              </Button>
            </TabsContent>

            <TabsContent value="urls" className="flex-1 min-h-0">
              <UrlLinksTab allBooks={allBooks} onMatchesReady={handleUrlMatchesReady} />
            </TabsContent>

            <TabsContent value="mega" className="flex-1 min-h-0">
              <MegaLinksTab allBooks={allBooks} onMatchesReady={handleMegaMatchesReady} />
            </TabsContent>

            <TabsContent value="manual" className="flex flex-col flex-1 min-h-0">
              <ManualAssignTab allBooks={allBooks} onDone={handleManualDone} />
            </TabsContent>
          </Tabs>
        )}

        {/* Step 2: Match preview (shared for upload & urls) */}
        {step === 2 && (
          <div className="flex flex-col flex-1 min-h-0 space-y-3">
            <div className="flex gap-3 text-sm">
              <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" /> Dopasowano: {stats.matched}</Badge>
              <Badge variant="secondary" className="bg-yellow-500 text-black"><AlertTriangle className="mr-1 h-3 w-3" /> Częściowo: {stats.partial}</Badge>
              <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Brak: {stats.unmatched}</Badge>
            </div>

            <ScrollArea className="flex-1 border rounded-md" style={{ maxHeight: "50vh" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{mode === "urls" ? "URL" : "Plik"}</TableHead>
                    <TableHead>Dopasowana książka</TableHead>
                    <TableHead className="w-20">Zgodność</TableHead>
                    <TableHead className="w-48">Akcja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs max-w-[200px] truncate" title={match.url || match.fileName}>
                        {match.fileName}
                      </TableCell>
                      <TableCell className="text-xs">
                        {match.bookTitle || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={match.status === "matched" ? "default" : match.status === "partial" ? "secondary" : "destructive"}
                          className={match.status === "matched" ? "bg-green-600" : match.status === "partial" ? "bg-yellow-500 text-black" : ""}
                        >
                          {Math.round(match.similarity * 100)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {allBooks && (
                          <Select value={match.bookId || ""} onValueChange={val => updateMatch(idx, val)}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Wybierz książkę" />
                            </SelectTrigger>
                            <SelectContent>
                              {allBooks.map(book => (
                                <SelectItem key={book.id} value={book.id}>{book.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex gap-2 justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Wstecz</Button>
              <Button onClick={startSave} disabled={validMatches.length === 0}>
                {mode === "mega" ? `Zapisz ${validMatches.length} linków Mega` : mode === "urls" ? `Zapisz ${validMatches.length} linków` : `Prześlij ${validMatches.length} plików`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Progress / results */}
        {step === 3 && (
          <div className="space-y-4 py-4">
            {uploading && mode === "upload" && (
              <>
                <div className="text-sm">
                  Przesyłanie {uploadIndex + 1}/{validMatches.length} —{" "}
                  <span className="font-medium">{validMatches[uploadIndex]?.fileName}</span>
                </div>
                <Progress value={((uploadIndex + 1) / validMatches.length) * 100} />
              </>
            )}
            {uploading && mode === "urls" && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Zapisywanie linków...
              </div>
            )}
            {uploading && mode === "mega" && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Zapisywanie linków Mega...
              </div>
            )}

            {uploadDone && (
              <div className="space-y-3">
                <div className="flex gap-3 text-sm">
                  <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" /> Sukces: {successCount}</Badge>
                  {failCount > 0 && <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Błędy: {failCount}</Badge>}
                </div>
                {failCount > 0 && (
                  <ScrollArea className="max-h-40 border rounded-md p-2">
                    {results.filter(r => !r.success).map((r, i) => (
                      <div key={i} className="text-xs text-destructive">{r.fileName}: {r.error}</div>
                    ))}
                  </ScrollArea>
                )}
                <Button onClick={() => handleOpenChange(false)} className="w-full">Zamknij</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
