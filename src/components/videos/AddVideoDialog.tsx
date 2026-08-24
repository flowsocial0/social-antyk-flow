import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, Link2, Info, Film } from "lucide-react";
import { toast } from "sonner";
import { MAX_UPLOAD_MB, isMegaUrl, uploadVideoFile } from "@/lib/videoLibrary";

interface AddVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export function AddVideoDialog({ open, onOpenChange, onAdded }: AddVideoDialogProps) {
  const [tab, setTab] = useState<"upload" | "mega">("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [megaUrl, setMegaUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setTags("");
    setFile(null);
    setMegaUrl("");
    setPhase("");
    setTab("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const oversized = !!file && file.size / (1024 * 1024) > MAX_UPLOAD_MB;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (selected && selected.size / (1024 * 1024) > MAX_UPLOAD_MB) {
      toast.error(`Plik jest za duży (${(selected.size / 1024 / 1024).toFixed(0)} MB)`, {
        description: `Bezpośrednio możesz wgrać maksymalnie ${MAX_UPLOAD_MB} MB. Wrzuć ten film na Mega.nz i dodaj go tutaj jako link — nie zajmie miejsca w aplikacji.`,
      });
    }
    if (selected && !title.trim()) {
      setTitle(selected.name.replace(/\.[^.]+$/, ""));
    }
  };


  const parsedTags = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const canSave =
    title.trim().length > 0 &&
    (tab === "upload" ? !!file && !oversized : isMegaUrl(megaUrl)) &&
    !saving;


  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Musisz być zalogowany.");

      if (tab === "upload") {
        if (!file) throw new Error("Wybierz plik wideo.");
        const uploaded = await uploadVideoFile(file, user.id, setPhase);
        setPhase("Zapisywanie w bibliotece...");
        const { error } = await (supabase as any).from("video_library").insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          source_type: "supabase_upload",
          tags: parsedTags,
          ...uploaded,
        });
        if (error) throw error;
      } else {
        setPhase("Zapisywanie linku...");
        const { error } = await (supabase as any).from("video_library").insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          source_type: "mega_link",
          mega_url: megaUrl.trim(),
          tags: parsedTags,
        });
        if (error) throw error;
      }

      toast.success("Wideo dodane do biblioteki");
      reset();
      onOpenChange(false);
      onAdded();
    } catch (err: any) {
      console.error("Add video error:", err);
      toast.error(err.message || "Nie udało się dodać wideo");
    } finally {
      setSaving(false);
      setPhase("");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Dodaj wideo do biblioteki
          </DialogTitle>
          <DialogDescription>
            Wgraj plik bezpośrednio albo podaj link z Mega.nz. Film z biblioteki możesz potem
            wykorzystać w dowolnej liczbie kampanii.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "upload" | "mega")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" disabled={saving}>
              <Upload className="h-4 w-4 mr-2" />
              Wgraj plik
            </TabsTrigger>
            <TabsTrigger value="mega" disabled={saving}>
              <Link2 className="h-4 w-4 mr-2" />
              Link Mega.nz
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="video-file">Plik wideo (max {MAX_UPLOAD_MB} MB)</Label>
              <Input
                id="video-file"
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
                disabled={saving}
              />
              {file && (
                <p className={`text-xs ${oversized ? "text-destructive" : "text-muted-foreground"}`}>
                  {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              )}
              {oversized && (
                <Alert variant="destructive">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Ten plik przekracza limit {MAX_UPLOAD_MB} MB dla bezpośredniego uploadu. Wrzuć
                    go na Mega.nz i dodaj w zakładce „Link Mega.nz” — film zostanie pobrany
                    automatycznie dopiero w chwili publikacji.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>


          <TabsContent value="mega" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="mega-url">Link do pliku na Mega.nz</Label>
              <Input
                id="mega-url"
                placeholder="https://mega.nz/file/..."
                value={megaUrl}
                onChange={(e) => setMegaUrl(e.target.value)}
                disabled={saving}
              />
              {megaUrl && !isMegaUrl(megaUrl) && (
                <p className="text-xs text-destructive">
                  To nie wygląda na link do pliku Mega.nz (wymagany format https://mega.nz/file/...).
                </p>
              )}
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Film zostaje na Twoim Mega.nz. Dopiero w chwili publikacji pobieramy go tymczasowo,
                wysyłamy na wybrane serwisy i od razu kasujemy kopię — nie zajmuje więc miejsca w
                aplikacji. Link musi być publiczny (z kluczem deszyfrującym w adresie).
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="video-title">Nazwa *</Label>
            <Input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Short — premiera książki"
              maxLength={200}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-desc">Opis (opcjonalnie)</Label>
            <Textarea
              id="video-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={1000}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-tags">Tagi (oddzielone przecinkiem)</Label>
            <Input
              id="video-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="shorts, promocja, zima"
              disabled={saving}
            />
          </div>
        </div>

        {saving && (
          <div className="space-y-2">
            <Progress value={undefined} className="h-2" />
            <p className="text-xs text-muted-foreground">{phase || "Pracuję..."}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Dodaj do biblioteki
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
