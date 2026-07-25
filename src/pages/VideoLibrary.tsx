import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Search, Loader2, Film, Info } from "lucide-react";
import { toast } from "sonner";
import { Footer } from "@/components/layout/Footer";
import { VideoCard } from "@/components/videos/VideoCard";
import { AddVideoDialog } from "@/components/videos/AddVideoDialog";
import {
  useVideoLibrary,
  filterAndSortVideos,
  type VideoSortKey,
} from "@/hooks/useVideoLibrary";
import { deleteVideoAssets, type LibraryVideo } from "@/lib/videoLibrary";

const VideoLibrary = () => {
  const navigate = useNavigate();
  const { videos, loading, error, reload, allTags } = useVideoLibrary();

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "supabase_upload" | "mega_link">("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [sort, setSort] = useState<VideoSortKey>("newest");
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LibraryVideo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visible = filterAndSortVideos(videos, search, sourceFilter, tagFilter, sort);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteVideoAssets(pendingDelete);
      const { error: deleteError } = await (supabase as any)
        .from("video_library")
        .delete()
        .eq("id", pendingDelete.id);
      if (deleteError) throw deleteError;
      toast.success("Wideo usunięte z biblioteki");
      setPendingDelete(null);
      reload();
    } catch (err: any) {
      console.error("Delete video error:", err);
      toast.error(err.message || "Nie udało się usunąć wideo");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Powrót
        </Button>

        <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Film className="h-7 w-7 text-primary" />
              Biblioteka wideo
            </h1>
            <p className="text-muted-foreground mt-1">
              Jedno miejsce na filmy, które wykorzystasz wielokrotnie w kampaniach.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj wideo
          </Button>
        </header>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Filmy wgrane do aplikacji publikujemy bezpośrednio. Filmy z Mega.nz pobieramy dopiero w
            chwili publikacji, wysyłamy na wybrane serwisy i natychmiast kasujemy kopię — dzięki temu
            duże pliki nie zajmują miejsca w aplikacji.
          </AlertDescription>
        </Alert>

        <Card className="p-4 mb-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Szukaj po nazwie, opisie lub tagu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Szukaj wideo"
              />
            </div>

            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
              <SelectTrigger aria-label="Filtruj po źródle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie źródła</SelectItem>
                <SelectItem value="supabase_upload">Wgrane w aplikacji</SelectItem>
                <SelectItem value="mega_link">Linki Mega.nz</SelectItem>
              </SelectContent>
            </Select>

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
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>Nie udało się wczytać biblioteki: {error}</AlertDescription>
          </Alert>
        ) : visible.length === 0 ? (
          <Card className="p-12 text-center">
            <Film className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">
              {videos.length === 0 ? "Biblioteka jest pusta" : "Brak wyników"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {videos.length === 0
                ? "Dodaj pierwszy film — wgraj plik albo wklej link z Mega.nz."
                : "Zmień filtry lub wyszukiwaną frazę."}
            </p>
            {videos.length === 0 && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj wideo
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((video) => (
              <VideoCard key={video.id} video={video} onDelete={setPendingDelete} />
            ))}
          </div>
        )}
      </main>

      <Footer />

      <AddVideoDialog open={addOpen} onOpenChange={setAddOpen} onAdded={reload} />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć „{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.source_type === "mega_link"
                ? "Usuniemy tylko wpis z biblioteki. Plik na Twoim Mega.nz pozostanie nietknięty."
                : "Plik zostanie trwale usunięty z aplikacji."}{" "}
              Zaplanowane posty, które już korzystają z tego wideo, mogą przestać działać.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VideoLibrary;
