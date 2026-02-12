import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Lightbulb } from "lucide-react";
import { toast } from "sonner";

interface FeatureRequestFormProps {
  open: boolean;
  onClose: () => void;
}

export const FeatureRequestForm = ({ open, onClose }: FeatureRequestFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Plik nie może być większy niż 5MB");
        return;
      }
      setAttachment(file);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Podaj tytuł pomysłu");
      return;
    }
    if (!description.trim()) {
      toast.error("Opisz swój pomysł");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Musisz być zalogowany");
        return;
      }

      let attachmentUrl: string | null = null;

      if (attachment) {
        const fileExt = attachment.name.split(".").pop();
        const filePath = `ideas/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("bug-reports")
          .upload(filePath, attachment);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Błąd uploadu załącznika");
        } else {
          const { data: urlData } = supabase.storage
            .from("bug-reports")
            .getPublicUrl(filePath);
          attachmentUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase.from("admin_ideas").insert({
        title: title.trim(),
        description: description.trim(),
        created_by: user.id,
        submitted_by_email: user.email,
        attachment_url: attachmentUrl,
        status: "new",
        priority: "medium",
      });

      if (error) {
        console.error("Error submitting idea:", error);
        toast.error("Błąd wysyłania pomysłu");
      } else {
        toast.success("Dziękujemy za pomysł! 💡");
        handleClose();
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Wystąpił błąd");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setAttachment(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Zaproponuj funkcję
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="idea-title">Tytuł *</Label>
            <Input
              id="idea-title"
              placeholder="Np. Export do PDF..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="idea-desc">Opis *</Label>
            <Textarea
              id="idea-desc"
              placeholder="Opisz, co by się przydało i dlaczego..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label>Załącznik (opcjonalnie)</Label>
            {attachment ? (
              <div className="flex items-center gap-2 mt-1 p-2 bg-muted rounded">
                <span className="text-sm truncate flex-1">{attachment.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttachment(null)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="mt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-4 w-4" />
                  Dodaj plik (max 5MB)
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleAttachmentChange}
                    accept="image/*,.pdf,.doc,.docx"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="h-4 w-4" />
              )}
              Wyślij pomysł
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
