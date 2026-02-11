import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit2, Save, X, Clock, CheckCircle2, AlertCircle, BookOpen, RefreshCw, Trash2, Calendar, RotateCcw, Info, Video, FileVideo, Image as ImageIcon, Upload } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { PlatformBadge } from "./PlatformBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Helper function to sanitize filenames for storage
const sanitizeFileName = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, c => ({
      'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
      'Ą':'A','Ć':'C','Ę':'E','Ł':'L','Ń':'N','Ó':'O','Ś':'S','Ź':'Z','Ż':'Z'
    })[c] || c)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
};

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
  error_message?: string | null;
  error_code?: string | null;
  retry_count?: number | null;
  next_retry_at?: string | null;
  platforms?: any; // jsonb array of platforms
  custom_image_url?: string | null;
  book?: {
    id: string;
    title: string;
    image_url: string | null;
    storage_path: string | null;
    product_url: string | null;
  } | null;
};

type CampaignPostCardProps = {
  post: CampaignPost;
  userId?: string;
  onSave?: (postId: string, newText: string) => Promise<void>;
  onRegenerate?: (postId: string) => Promise<void>;
  onDelete?: (postId: string) => Promise<void>;
  onUpdateSchedule?: (postId: string, newScheduledAt: string) => Promise<void>;
  onRetry?: (postId: string) => Promise<void>;
  onUpdateMedia?: (postId: string, mediaUrl: string | null) => Promise<void>;
  readOnly?: boolean;
};

export const CampaignPostCard = ({ post, userId, onSave, onRegenerate, onDelete, onUpdateSchedule, onRetry, onUpdateMedia, readOnly = false }: CampaignPostCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editedText, setEditedText] = useState(post.text);
  const [editedSchedule, setEditedSchedule] = useState(
    format(new Date(post.scheduled_at), "yyyy-MM-dd'T'HH:mm")
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [pendingMediaFile, setPendingMediaFile] = useState<File | null>(null);
  const [pendingMediaPreview, setPendingMediaPreview] = useState<string>('');

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

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(post.id);
    } catch (error) {
      console.error("Error regenerating post:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !confirm('Czy na pewno chcesz usunąć ten post?')) return;
    setIsDeleting(true);
    try {
      await onDelete(post.id);
    } catch (error) {
      console.error("Error deleting post:", error);
      setIsDeleting(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!onUpdateSchedule) return;
    setIsSaving(true);
    try {
      const newDate = new Date(editedSchedule);
      await onUpdateSchedule(post.id, newDate.toISOString());
      setIsEditingSchedule(false);
    } catch (error) {
      console.error("Error updating schedule:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSchedule = () => {
    setEditedSchedule(format(new Date(post.scheduled_at), "yyyy-MM-dd'T'HH:mm"));
    setIsEditingSchedule(false);
  };

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry(post.id);
    } catch (error) {
      console.error("Error retrying post:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingMediaFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPendingMediaPreview(previewUrl);
    }
  };

  const clearPendingMedia = () => {
    if (pendingMediaPreview) {
      URL.revokeObjectURL(pendingMediaPreview);
    }
    setPendingMediaFile(null);
    setPendingMediaPreview('');
  };

  const handleUploadMedia = async () => {
    if (!pendingMediaFile || !userId || !onUpdateMedia) return;
    
    setIsUploadingMedia(true);
    try {
      const isVideo = pendingMediaFile.type.startsWith('video/');
      const folder = isVideo ? 'videos' : 'images';
      const fileName = `${userId}/${folder}/${Date.now()}_${sanitizeFileName(pendingMediaFile.name)}`;
      
      const { error: uploadError } = await supabase.storage
        .from('ObrazkiKsiazek')
        .upload(fileName, pendingMediaFile, { upsert: true });
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Błąd podczas przesyłania pliku');
        return;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('ObrazkiKsiazek')
        .getPublicUrl(fileName);
      
      await onUpdateMedia(post.id, publicUrlData.publicUrl);
      clearPendingMedia();
      toast.success('Media zostały zaktualizowane');
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error('Błąd podczas przesyłania pliku');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleRemoveMedia = async () => {
    if (!onUpdateMedia) return;
    if (!confirm('Czy na pewno chcesz usunąć media z tego posta?')) return;
    
    try {
      await onUpdateMedia(post.id, null);
      toast.success('Media zostały usunięte');
    } catch (error) {
      console.error('Error removing media:', error);
      toast.error('Błąd podczas usuwania mediów');
    }
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
      case 'rate_limited':
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3" />
            Rate Limit
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

  const platforms: ('x' | 'facebook')[] = Array.isArray(post.platforms) 
    ? (post.platforms.filter((p: any) => p === 'x' || p === 'facebook') as ('x' | 'facebook')[])
    : ['x'];

  return (
    <Card className="p-4 hover:shadow-card transition-all duration-300">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2 flex-wrap items-center">
          {getTypeBadge()}
          {getStatusBadge()}
          {/* Subtle retry indicator */}
          {post.retry_count > 0 && (
            <Badge variant="outline" className="text-xs gap-1 bg-orange-500/5 text-orange-600 border-orange-500/20">
              <RotateCcw className="h-3 w-3" />
              Próba {post.retry_count}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">{post.category}</Badge>
          {/* Platform badges */}
          {platforms.map((platform) => (
            <PlatformBadge key={platform} platform={platform} status={post.status as any} />
          ))}
        </div>
        {isEditingSchedule ? (
          <div className="flex gap-2 items-center">
            <Input
              type="datetime-local"
              value={editedSchedule}
              onChange={(e) => setEditedSchedule(e.target.value)}
              className="w-auto text-sm"
            />
            <Button
              size="sm"
              onClick={handleSaveSchedule}
              disabled={isSaving}
              className="gap-1"
            >
              <Save className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelSchedule}
              disabled={isSaving}
              className="gap-1"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              {format(new Date(post.scheduled_at), "d MMM, HH:mm", { locale: pl })}
              {/* Show retry info */}
              {post.retry_count > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  Próby publikacji: {post.retry_count}
                  {post.next_retry_at && post.status === 'rate_limited' && (
                    <span className="block">
                      Kolejna: {format(new Date(post.next_retry_at), "d MMM, HH:mm", { locale: pl })}
                    </span>
                  )}
                </div>
              )}
            </div>
            {!readOnly && post.status === 'scheduled' && onUpdateSchedule && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingSchedule(true)}
                className="h-6 w-6 p-0"
              >
                <Calendar className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
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
          
          {/* Error message display - collapsible */}
          {(post.status === 'rate_limited' || post.status === 'failed' || (post.status === 'scheduled' && (post.retry_count ?? 0) > 0)) && (
            <Collapsible open={isErrorExpanded} onOpenChange={setIsErrorExpanded}>
              <div className={`rounded-lg border ${
                post.status === 'rate_limited' 
                  ? 'bg-yellow-500/10 border-yellow-500/20' 
                  : post.status === 'failed'
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-orange-500/10 border-orange-500/20'
              }`}>
                <CollapsibleTrigger className="w-full p-3 flex items-start gap-2 hover:bg-background/5 transition-colors">
                  <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                    post.status === 'rate_limited' ? 'text-yellow-600' : 
                    post.status === 'failed' ? 'text-red-600' : 'text-orange-600'
                  }`} />
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-medium ${
                      post.status === 'rate_limited' ? 'text-yellow-600' : 
                      post.status === 'failed' ? 'text-red-600' : 'text-orange-600'
                    }`}>
                      {post.status === 'scheduled' && post.retry_count ? 
                        `Poprzednie próby publikacji (${post.retry_count}x) - kliknij by zobaczyć szczegóły` :
                        'Kliknij by zobaczyć szczegóły błędu'
                      }
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {isErrorExpanded ? '▼' : '▶'}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <div className="pt-2 border-t border-current/10">
                    <p className={`text-sm ${
                      post.status === 'rate_limited' ? 'text-yellow-600/90' : 
                      post.status === 'failed' ? 'text-red-600/90' : 'text-orange-600/90'
                    }`}>
                    {post.error_message || 'Wystąpił błąd podczas publikacji. Sprawdź połączenie z kontem i spróbuj ponownie.'}
                    </p>
                    {post.error_message && /permission|granted|unauthorized|auth|token|expired|invalid.*token|access.*denied/i.test(post.error_message) && (
                      <p className="text-xs font-medium text-orange-600 mt-2 p-2 bg-orange-500/10 rounded">
                        💡 Wskazówka: Spróbuj rozłączyć i ponownie połączyć konto na stronie danej platformy. Uprawnienia mogły wygasnąć lub nie zostały w pełni zaakceptowane.
                      </p>
                    )}
                    {post.error_code && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Kod błędu: {post.error_code}
                      </p>
                    )}
                    {post.next_retry_at && post.status === 'rate_limited' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatyczna ponowna próba: {format(new Date(post.next_retry_at), "d MMMM yyyy, HH:mm", { locale: pl })}
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Post media preview - custom or from book */}
          {(() => {
            const mediaUrl = post.custom_image_url || post.book?.image_url || 
              (post.book?.storage_path 
                ? `https://dmrfbokchkxjzslfzeps.supabase.co/storage/v1/object/public/ObrazkiKsiazek/${post.book.storage_path}`
                : null);
            
            if (!mediaUrl) return null;
            
            // Check if it's a video based on extension
            const isVideo = /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(mediaUrl);
            
            // Extract filename for display
            const getFileName = (url: string) => {
              try {
                const decoded = decodeURIComponent(url);
                const parts = decoded.split('/');
                return parts[parts.length - 1] || 'Wideo';
              } catch {
                return 'Wideo';
              }
            };
            
            if (isVideo) {
              return (
                <div className="mb-3 flex items-center gap-3 p-3 bg-muted/30 rounded-lg border max-w-[300px]">
                  <div className="relative flex-shrink-0">
                    <video
                      src={mediaUrl}
                      className="h-16 w-24 object-cover rounded"
                      muted
                      preload="metadata"
                      onError={(e) => {
                        (e.target as HTMLVideoElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                      <FileVideo className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>Wideo</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate" title={getFileName(mediaUrl)}>
                      {getFileName(mediaUrl)}
                    </p>
                  </div>
                </div>
              );
            }
            
            return (
              <div className="mb-3">
                <img
                  src={mediaUrl}
                  alt="Obrazek posta"
                  className="w-full max-w-[200px] h-auto object-cover rounded-lg border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            );
          })()}

          {post.book && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              {(post.book.image_url || post.book.storage_path) && !post.custom_image_url && (
                <img
                  src={
                    post.book.image_url || 
                    `https://dmrfbokchkxjzslfzeps.supabase.co/storage/v1/object/public/ObrazkiKsiazek/${post.book.storage_path}`
                  }
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
            <div className="space-y-3">
              {/* Media upload/change section */}
              {onUpdateMedia && userId && (
                <div className="p-3 bg-muted/30 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Media posta</Label>
                    {post.custom_image_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRemoveMedia}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                        Usuń media
                      </Button>
                    )}
                  </div>
                  
                  {pendingMediaPreview ? (
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {pendingMediaFile?.type.startsWith('video/') ? (
                          <div className="relative">
                            <video
                              src={pendingMediaPreview}
                              className="h-16 w-24 object-cover rounded"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded">
                              <Video className="h-5 w-5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={pendingMediaPreview}
                            alt="Podgląd"
                            className="h-16 w-auto rounded object-cover"
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleUploadMedia}
                          disabled={isUploadingMedia}
                          className="gap-1"
                        >
                          <Upload className="h-3 w-3" />
                          {isUploadingMedia ? 'Przesyłanie...' : 'Zapisz'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={clearPendingMedia}
                          disabled={isUploadingMedia}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg hover:bg-muted/50 transition-colors text-sm">
                        <ImageIcon className="h-4 w-4" />
                        {post.custom_image_url ? 'Zmień grafikę' : 'Dodaj grafikę'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleMediaFileChange}
                        />
                      </Label>
                      <Label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-lg hover:bg-muted/50 transition-colors text-sm">
                        <Video className="h-4 w-4" />
                        {post.custom_image_url ? 'Zmień wideo' : 'Dodaj wideo'}
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={handleMediaFileChange}
                        />
                      </Label>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  className="gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  Edytuj tekst
                </Button>
                {onRegenerate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                    Regeneruj AI
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Usuń
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {!readOnly && (post.status === 'failed' || post.status === 'rate_limited') && (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="default"
                onClick={handleRetry}
                disabled={isRetrying}
                className="gap-1"
              >
                <RotateCcw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? "Planowanie..." : "Wyślij ponownie"}
              </Button>
              {onDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Usuń
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
