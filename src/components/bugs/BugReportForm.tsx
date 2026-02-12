import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BugReportFormProps {
  open: boolean;
  onClose: () => void;
  screenshot: Blob | null;
  screenshotUrl: string | null;
}

export const BugReportForm = ({ open, onClose, screenshot, screenshotUrl }: BugReportFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAdditionalFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: "Wypełnij wymagane pola", description: "Temat i opis są wymagane.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nie zalogowany");

      const pageUrl = window.location.href;
      const userAgent = navigator.userAgent;
      const screenSize = `${window.innerWidth}x${window.innerHeight}`;

      // Upload screenshot
      let screenshotStorageUrl: string | null = null;
      if (screenshot) {
        const screenshotPath = `${user.id}/${Date.now()}_screenshot.png`;
        const { error: uploadErr } = await supabase.storage
          .from("bug-reports")
          .upload(screenshotPath, screenshot, { contentType: "image/png" });
        
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("bug-reports").getPublicUrl(screenshotPath);
          screenshotStorageUrl = urlData.publicUrl;
        }
      }

      // Insert bug report
      const { data: report, error: insertErr } = await (supabase as any)
        .from("bug_reports")
        .insert({
          user_id: user.id,
          user_email: user.email,
          title: title.trim(),
          description: description.trim(),
          page_url: pageUrl,
          user_agent: userAgent,
          screen_size: screenSize,
          screenshot_url: screenshotStorageUrl,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Upload additional files
      for (const file of additionalFiles) {
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: fileErr } = await supabase.storage
          .from("bug-reports")
          .upload(filePath, file);

        if (!fileErr) {
          const { data: fileUrlData } = supabase.storage.from("bug-reports").getPublicUrl(filePath);
          await (supabase as any).from("bug_report_attachments").insert({
            bug_report_id: report.id,
            file_url: fileUrlData.publicUrl,
            file_name: file.name,
            file_type: file.type,
            uploaded_by: user.id,
          });
        }
      }

      // Send email notification
      try {
        await supabase.functions.invoke("send-bug-report-email", {
          body: { type: "new_report", reportId: report.id },
        });
      } catch (emailErr) {
        console.error("Email notification failed:", emailErr);
      }

      toast({ title: "Zgłoszenie wysłane!", description: "Dziękujemy za zgłoszenie błędu." });
      onClose();
    } catch (err: any) {
      console.error("Bug report error:", err);
      toast({ title: "Błąd", description: err.message || "Nie udało się wysłać zgłoszenia.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zgłoś błąd</DialogTitle>
          <DialogDescription>Opisz problem, który napotkałeś. Zrzut ekranu został dołączony automatycznie.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bug-title">Temat *</Label>
            <Input
              id="bug-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Np. Przycisk nie działa na stronie kampanii"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-desc">Opis *</Label>
            <Textarea
              id="bug-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opisz dokładnie co się stało, czego oczekiwałeś i jakie kroki doprowadziły do błędu..."
              rows={4}
              maxLength={2000}
            />
          </div>

          {screenshotUrl && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Automatyczny zrzut ekranu
              </Label>
              <img
                src={screenshotUrl}
                alt="Screenshot"
                className="w-full rounded-md border border-border max-h-48 object-contain bg-muted"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Dodatkowe załączniki</Label>
            <div
              className="border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Kliknij aby dodać pliki</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,.pdf,.txt,.log"
              />
            </div>
            {additionalFiles.length > 0 && (
              <div className="space-y-1">
                {additionalFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-muted rounded px-3 py-1">
                    <span className="truncate">{file.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Automatycznie zebrane dane: URL strony, przeglądarka, rozdzielczość ekranu</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Wyślij zgłoszenie
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
