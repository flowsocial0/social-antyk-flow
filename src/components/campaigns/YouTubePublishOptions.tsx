import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Youtube, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type YouTubePublishOptionsValue = {
  title: string;
  description: string;
  thumbnailUrl?: string;
  privacyStatus: "public" | "unlisted" | "private";
  tags: string;
};

export const defaultYouTubeOptions = (): YouTubePublishOptionsValue => ({
  title: "",
  description: "",
  thumbnailUrl: undefined,
  privacyStatus: "public",
  tags: "",
});

interface Props {
  value: YouTubePublishOptionsValue;
  onChange: (value: YouTubePublishOptionsValue) => void;
}

export const YouTubePublishOptions = ({ value, onChange }: Props) => {
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof YouTubePublishOptionsValue>(key: K, v: YouTubePublishOptionsValue[K]) =>
    onChange({ ...value, [key]: v });

  const handleThumbnail = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Miniaturka może mieć maksymalnie 2 MB (limit YouTube).");
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nie zalogowany");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/thumbnails/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("ObrazkiKsiazek").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("ObrazkiKsiazek").getPublicUrl(path);
      set("thumbnailUrl", publicUrl);
      toast.success("Miniaturka przesłana");
    } catch (e: any) {
      toast.error("Błąd przesyłania miniaturki: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6 space-y-5 border-red-500/30">
      <div className="flex items-center gap-2">
        <Youtube className="h-5 w-5 text-red-500" />
        <h3 className="text-lg font-semibold">Ustawienia publikacji na YouTube</h3>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Jeśli zostawisz pola puste, użyjemy tytułu pliku wideo i treści posta jako opisu.
      </p>

      <div className="space-y-2">
        <Label>Tytuł filmu (max 100 znaków)</Label>
        <Input
          maxLength={100}
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="np. Liam i Klemcia bawią się z husky"
        />
        <p className="text-xs text-muted-foreground">{value.title.length}/100</p>
      </div>

      <div className="space-y-2">
        <Label>Opis filmu</Label>
        <Textarea
          rows={4}
          maxLength={5000}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Opis widoczny pod filmem na YouTube..."
        />
        <p className="text-xs text-muted-foreground">{value.description.length}/5000</p>
      </div>

      <div className="space-y-2">
        <Label>Tagi (oddzielone przecinkami)</Label>
        <Input
          value={value.tags}
          onChange={(e) => set("tags", e.target.value)}
          placeholder="husky, pies, rodzina"
        />
      </div>

      <div className="space-y-2">
        <Label>Widoczność</Label>
        <Select value={value.privacyStatus} onValueChange={(v) => set("privacyStatus", v as YouTubePublishOptionsValue["privacyStatus"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Publiczny — widoczny dla wszystkich</SelectItem>
            <SelectItem value="unlisted">Niepubliczny — tylko z linkiem</SelectItem>
            <SelectItem value="private">Prywatny — tylko Ty</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Miniaturka (opcjonalnie, max 2 MB)</Label>
        {value.thumbnailUrl ? (
          <div className="flex items-center gap-3">
            <img src={value.thumbnailUrl} alt="Miniaturka filmu YouTube" className="h-20 w-36 object-cover rounded-md border" />
            <Button variant="outline" size="sm" onClick={() => set("thumbnailUrl", undefined)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Usuń
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/jpeg,image/png"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleThumbnail(f);
              }}
            />
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Miniaturka działa tylko na kanałach ze zweryfikowanym numerem telefonu — w innym wypadku YouTube ją pominie.
        </p>
      </div>
    </Card>
  );
};
