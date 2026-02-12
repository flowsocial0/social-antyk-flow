import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Send, Upload, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface BugReport {
  id: string;
  user_email: string;
  title: string;
  description: string;
  status: string;
  page_url: string | null;
  user_agent: string | null;
  screen_size: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  user_email: string;
  comment_text: string;
  created_at: string;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  nowy: "Nowy",
  w_trakcie: "W trakcie",
  potrzebne_informacje: "Potrzebne info",
  rozwiazany: "Rozwiązany",
  anulowane: "Anulowane",
};

interface BugReportDetailProps {
  report: BugReport;
  onBack: () => void;
}

export const BugReportDetail = ({ report, onBack }: BugReportDetailProps) => {
  const [status, setStatus] = useState(report.status);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      const [commentsRes, attachmentsRes] = await Promise.all([
        (supabase as any).from("bug_report_comments").select("*").eq("bug_report_id", report.id).order("created_at", { ascending: true }),
        (supabase as any).from("bug_report_attachments").select("*").eq("bug_report_id", report.id),
      ]);
      setComments(commentsRes.data || []);
      setAttachments(attachmentsRes.data || []);
      setLoading(false);
    };
    fetchDetails();
  }, [report.id]);

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await (supabase as any)
      .from("bug_reports")
      .update({ status: newStatus })
      .eq("id", report.id);

    if (error) {
      toast({ title: "Błąd", description: "Nie udało się zmienić statusu.", variant: "destructive" });
      return;
    }

    setStatus(newStatus);
    toast({ title: "Status zmieniony", description: `Nowy status: ${STATUS_LABELS[newStatus]}` });

    // Send email about status change
    try {
      await supabase.functions.invoke("send-bug-report-email", {
        body: { type: "status_change", reportId: report.id, newStatus },
      });
    } catch (e) {
      console.error("Email notification failed:", e);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: comment, error } = await (supabase as any)
        .from("bug_report_comments")
        .insert({
          bug_report_id: report.id,
          user_id: user.id,
          user_email: user.email,
          comment_text: newComment.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Upload comment attachments
      for (const file of commentFiles) {
        const filePath = `comments/${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("bug-reports").upload(filePath, file);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("bug-reports").getPublicUrl(filePath);
          await (supabase as any).from("bug_report_attachments").insert({
            bug_report_id: report.id,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: file.type,
            uploaded_by: user.id,
          });
        }
      }

      setComments(prev => [...prev, comment]);
      setNewComment("");
      setCommentFiles([]);

      // Refresh attachments
      const { data: newAttachments } = await (supabase as any).from("bug_report_attachments").select("*").eq("bug_report_id", report.id);
      if (newAttachments) setAttachments(newAttachments);

      // Send email about new comment
      try {
        await supabase.functions.invoke("send-bug-report-email", {
          body: { type: "new_comment", reportId: report.id, commentId: comment.id },
        });
      } catch (e) {
        console.error("Email notification failed:", e);
      }

      toast({ title: "Komentarz dodany" });
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Powrót do listy
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{report.title}</CardTitle>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Zgłaszający:</span>
              <p className="font-medium">{report.user_email}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data:</span>
              <p className="font-medium">{format(new Date(report.created_at), "dd MMM yyyy HH:mm", { locale: pl })}</p>
            </div>
            {report.page_url && (
              <div className="col-span-2">
                <span className="text-muted-foreground">URL strony:</span>
                <p className="font-medium break-all">{report.page_url}</p>
              </div>
            )}
            {report.screen_size && (
              <div>
                <span className="text-muted-foreground">Rozdzielczość:</span>
                <p className="font-medium">{report.screen_size}</p>
              </div>
            )}
            {report.user_agent && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Przeglądarka:</span>
                <p className="font-medium text-xs break-all">{report.user_agent}</p>
              </div>
            )}
          </div>

          <div>
            <span className="text-sm text-muted-foreground">Opis:</span>
            <p className="mt-1 whitespace-pre-wrap">{report.description}</p>
          </div>

          {report.screenshot_url && (
            <div>
              <span className="text-sm text-muted-foreground">Zrzut ekranu:</span>
              <a href={report.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img src={report.screenshot_url} alt="Screenshot" className="mt-1 max-h-64 rounded-md border border-border object-contain cursor-pointer hover:opacity-80" />
              </a>
            </div>
          )}

          {attachments.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">Załączniki:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {attachments.map((att) => (
                  <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm bg-muted rounded px-3 py-1 hover:bg-muted/80">
                    <ExternalLink className="h-3 w-3" />
                    {att.file_name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Komentarze ({comments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          ) : (
            <>
              {comments.map((c) => (
                <div key={c.id} className="border border-border rounded-md p-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-medium">{c.user_email}</span>
                    <span>{format(new Date(c.created_at), "dd MMM yyyy HH:mm", { locale: pl })}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.comment_text}</p>
                </div>
              ))}

              <div className="space-y-2 pt-2 border-t border-border">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Dodaj komentarz..."
                  rows={3}
                  maxLength={2000}
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1"
                  >
                    <Upload className="h-3 w-3" /> Załącznik
                  </Button>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
                    if (e.target.files) setCommentFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  }} />
                  {commentFiles.map((f, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {f.name}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setCommentFiles(prev => prev.filter((_, idx) => idx !== i))} />
                    </Badge>
                  ))}
                  <div className="flex-1" />
                  <Button size="sm" onClick={handleAddComment} disabled={submitting || !newComment.trim()} className="gap-1">
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Wyślij
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
