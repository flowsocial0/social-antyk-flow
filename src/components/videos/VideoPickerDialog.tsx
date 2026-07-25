import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Loader2, Film, Plus } from "lucide-react";
import { VideoCard } from "@/components/videos/VideoCard";
import { AddVideoDialog } from "@/components/videos/AddVideoDialog";
import {
  useVideoLibrary,
  filterAndSortVideos,
  type VideoSortKey,
} from "@/hooks/useVideoLibrary";
import { getVideoUrl, type LibraryVideo } from "@/lib/videoLibrary";

interface VideoPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the publishable URL (direct file URL or Mega link) plus the library row. */
  onSelect: (url: string, video: LibraryVideo) => void;
}

export function VideoPickerDialog({ open, onOpenChange, onSelect }: VideoPickerDialogProps) {
  const { videos, loading, reload, allTags } = useVideoLibrary();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sort, setSort] = useState<VideoSortKey>("newest");
  const [selected, setSelected] = useState<LibraryVideo | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Nested dialogs conflict (focus trap + scroll lock), so we hide the picker while adding
  const openAdd = () => {
    onOpenChange(false);
    setTimeout(() => setAddOpen(true), 80);
  };

  const handleAddOpenChange = (next: boolean) => {
    setAddOpen(next);
    if (!next) setTimeout(() => onOpenChange(true), 80);
  };


  const visible = filterAndSortVideos(videos, search, "all", tagFilter, sort);

  const handleConfirm = () => {
    if (!selected) return;
    const url = getVideoUrl(selected);
    if (!url) return;
    onSelect(url, selected);
    setSelected(null);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              Wybierz wideo z biblioteki
            </DialogTitle>
            <DialogDescription>
              Filmy z Mega.nz pobierzemy automatycznie dopiero w chwili publikacji.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Szukaj..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Szukaj wideo w bibliotece"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as VideoSortKey)}>
              <SelectTrigger aria-label="Sortowanie">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Najnowsze</SelectItem>
                <SelectItem value="oldest">Najstarsze</SelectItem>
                <SelectItem value="title">Nazwa A–Z</SelectItem>
                <SelectItem value="most_used">Najczęściej używane</SelectItem>
              </SelectContent>
            </Select>
            {allTags.length > 0 && (
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger aria-label="Filtruj po tagu">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie tagi</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={openAdd} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Dodaj wideo
            </Button>
          </div>


          <div className="flex-1 overflow-y-auto -mx-1 px-1 py-2">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : visible.length === 0 ? (
              <div className="text-center py-12">
                <Film className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">
                  {videos.length === 0
                    ? "Biblioteka jest pusta — dodaj pierwszy film."
                    : "Brak wyników dla tych filtrów."}
                </p>
                <Button variant="outline" onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj wideo
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {visible.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    selectable
                    selected={selected?.id === video.id}
                    onToggleSelect={(v) => setSelected(selected?.id === v.id ? null : v)}
                  />
                ))}
              </div>
            )}
          </div>

          {selected && (
            <Alert>
              <AlertDescription className="text-sm">
                Wybrano: <strong>{selected.title}</strong>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button onClick={handleConfirm} disabled={!selected}>
              Użyj tego wideo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddVideoDialog open={addOpen} onOpenChange={handleAddOpenChange} onAdded={reload} />
    </>
  );
}
