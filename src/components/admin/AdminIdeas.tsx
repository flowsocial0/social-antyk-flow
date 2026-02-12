import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Trash2, Edit2, Save, X, Lightbulb } from "lucide-react";
import { toast } from "sonner";

interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  submitted_by_email: string | null;
  attachment_url: string | null;
}

const STATUS_OPTIONS = [
  { value: "new", label: "Nowy", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "in_progress", label: "W trakcie", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  { value: "done", label: "Gotowe", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  { value: "rejected", label: "Odrzucone", color: "bg-red-500/10 text-red-600 border-red-500/20" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Niski", color: "bg-gray-500/10 text-gray-600" },
  { value: "medium", label: "Średni", color: "bg-orange-500/10 text-orange-600" },
  { value: "high", label: "Wysoki", color: "bg-red-500/10 text-red-600" },
];

export const AdminIdeas = () => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", status: "", priority: "" });

  const fetchIdeas = async () => {
    const { data, error } = await supabase
      .from("admin_ideas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching ideas:", error);
      toast.error("Błąd ładowania pomysłów");
    } else {
      setIdeas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchIdeas();
  }, []);

  const handleAddIdea = async () => {
    if (!newTitle.trim()) {
      toast.error("Podaj tytuł pomysłu");
      return;
    }

    setIsAdding(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("admin_ideas").insert({
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      priority: newPriority,
      created_by: user?.id,
    });

    if (error) {
      console.error("Error adding idea:", error);
      toast.error("Błąd dodawania pomysłu");
    } else {
      toast.success("Pomysł dodany");
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
      fetchIdeas();
    }
    setIsAdding(false);
  };

  const handleUpdateIdea = async (id: string) => {
    const { error } = await supabase
      .from("admin_ideas")
      .update({
        title: editForm.title,
        description: editForm.description || null,
        status: editForm.status,
        priority: editForm.priority,
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating idea:", error);
      toast.error("Błąd aktualizacji");
    } else {
      toast.success("Pomysł zaktualizowany");
      setEditingId(null);
      fetchIdeas();
    }
  };

  const handleDeleteIdea = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten pomysł?")) return;

    const { error } = await supabase.from("admin_ideas").delete().eq("id", id);

    if (error) {
      console.error("Error deleting idea:", error);
      toast.error("Błąd usuwania");
    } else {
      toast.success("Pomysł usunięty");
      fetchIdeas();
    }
  };

  const startEditing = (idea: Idea) => {
    setEditingId(idea.id);
    setEditForm({
      title: idea.title,
      description: idea.description || "",
      status: idea.status,
      priority: idea.priority,
    });
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find((o) => o.value === status);
    return (
      <Badge variant="secondary" className={option?.color || ""}>
        {option?.label || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const option = PRIORITY_OPTIONS.find((o) => o.value === priority);
    return (
      <Badge variant="outline" className={option?.color || ""}>
        {option?.label || priority}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Pomysły do wdrożenia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new idea form */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <Input
            placeholder="Tytuł pomysłu..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Textarea
            placeholder="Opis (opcjonalnie)..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2 items-center">
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddIdea} disabled={isAdding} className="gap-2">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Dodaj pomysł
            </Button>
          </div>
        </div>

        {/* Ideas list */}
        <div className="space-y-3">
          {ideas.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Brak pomysłów</p>
          ) : (
            ideas.map((idea) => (
              <div
                key={idea.id}
                className="p-4 border rounded-lg hover:bg-muted/20 transition-colors"
              >
                {editingId === idea.id ? (
                  <div className="space-y-3">
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Select
                        value={editForm.status}
                        onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editForm.priority}
                        onValueChange={(v) => setEditForm({ ...editForm, priority: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => handleUpdateIdea(idea.id)} className="gap-1">
                        <Save className="h-3 w-3" />
                        Zapisz
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                        className="gap-1"
                      >
                        <X className="h-3 w-3" />
                        Anuluj
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{idea.title}</span>
                        {getStatusBadge(idea.status)}
                        {getPriorityBadge(idea.priority)}
                      </div>
                      {idea.description && (
                        <p className="text-sm text-muted-foreground">{idea.description}</p>
                      )}
                      {idea.submitted_by_email && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Od: {idea.submitted_by_email}
                        </p>
                      )}
                      {idea.attachment_url && (
                        <a
                          href={idea.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-1 inline-block"
                        >
                          📎 Załącznik
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(idea)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteIdea(idea.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
