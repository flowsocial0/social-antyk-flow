import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Film, Link2, HardDrive, Trash2, Clock, Check } from "lucide-react";
import { formatDuration, formatSize, type LibraryVideo } from "@/lib/videoLibrary";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  video: LibraryVideo;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (video: LibraryVideo) => void;
  onDelete?: (video: LibraryVideo) => void;
}

export function VideoCard({
  video,
  selectable = false,
  selected = false,
  onToggleSelect,
  onDelete,
}: VideoCardProps) {
  const isMega = video.source_type === "mega_link";

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/50 bg-gradient-card transition-all",
        selectable && "cursor-pointer hover:shadow-glow",
        selected && "ring-2 ring-primary"
      )}
      onClick={selectable ? () => onToggleSelect?.(video) : undefined}
    >
      <div className="relative aspect-video bg-muted flex items-center justify-center">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={`Miniatura wideo: ${video.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Film className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        )}

        {selectable && (
          <div className="absolute top-2 left-2">
            <Checkbox checked={selected} aria-label={`Wybierz ${video.title}`} />
          </div>
        )}

        <Badge
          variant="secondary"
          className="absolute top-2 right-2 gap-1 text-[10px]"
        >
          {isMega ? <Link2 className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
          {isMega ? "Mega.nz" : "W aplikacji"}
        </Badge>

        {video.duration_sec != null && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 right-2 gap-1 text-[10px]"
          >
            <Clock className="h-3 w-3" />
            {formatDuration(video.duration_sec)}
          </Badge>
        )}

        {selected && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <div className="rounded-full bg-primary p-2">
              <Check className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <h3 className="font-medium text-sm line-clamp-1" title={video.title}>
          {video.title}
        </h3>
        {video.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{video.description}</p>
        )}

        <div className="flex flex-wrap gap-1">
          {video.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{isMega ? "Pobierane przy publikacji" : formatSize(video.file_size_mb)}</span>
          <span>Użyto: {video.usage_count}×</span>
        </div>

        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(video);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Usuń
          </Button>
        )}
      </div>
    </Card>
  );
}
