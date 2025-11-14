import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Save, X, Clock, CheckCircle2, AlertCircle, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

type CampaignPost = {
  id: string;
  day: number;
  time: string;
  type: string;
  category: string;
  text: string;
  scheduled_at: string;
  published_at: string | null;
  status: string;
  book?: {
    id: string;
    title: string;
    image_url: string | null;
    product_url: string | null;
  } | null;
};

type CampaignPostCardProps = {
  post: CampaignPost;
  onSave?: (postId: string, newText: string) => Promise<void>;
  readOnly?: boolean;
};

export const CampaignPostCard = ({ post, onSave, readOnly = false }: CampaignPostCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(post.text);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(post.id, editedText);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving post:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedText(post.text);
    setIsEditing(false);
  };

  const getStatusBadge = () => {
    switch (post.status) {
      case 'scheduled':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Zaplanowany
          </Badge>
        );
      case 'published':
        return (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Opublikowany
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="secondary" className="gap-1 bg-red-500/10 text-red-600 border-red-500/20">
            <AlertCircle className="h-3 w-3" />
            Błąd
          </Badge>
        );
      default:
        return <Badge variant="secondary">{post.status}</Badge>;
    }
  };

  const getTypeBadge = () => {
    if (post.type === 'content') {
      return <Badge variant="secondary">Content</Badge>;
    }
    return <Badge className="bg-gradient-primary">Sprzedaż</Badge>;
  };

  return (
    <Card className="p-4 hover:shadow-card transition-all duration-300">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          {getTypeBadge()}
          {getStatusBadge()}
          <Badge variant="outline" className="text-xs">{post.category}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {format(new Date(post.scheduled_at), "d MMM, HH:mm", { locale: pl })}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={6}
            className="w-full"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-1"
            >
              <Save className="h-3 w-3" />
              Zapisz
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              className="gap-1"
            >
              <X className="h-3 w-3" />
              Anuluj
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm whitespace-pre-wrap">{post.text}</p>

          {post.book && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              {post.book.image_url && (
                <img
                  src={post.book.image_url}
                  alt={post.book.title}
                  className="h-16 w-12 object-cover rounded"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{post.book.title}</span>
                </div>
                {post.book.product_url && (
                  <a
                    href={post.book.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Zobacz produkt →
                  </a>
                )}
              </div>
            </div>
          )}

          {!readOnly && post.status === 'scheduled' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="gap-1"
            >
              <Edit2 className="h-3 w-3" />
              Edytuj
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};
