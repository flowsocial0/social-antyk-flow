import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Settings, Save } from "lucide-react";

interface DefaultSettings {
  ai_suffix_x: string;
  ai_suffix_facebook: string;
  ai_suffix_instagram: string;
  ai_suffix_linkedin: string;
  ai_suffix_tiktok: string;
  ai_suffix_youtube: string;
  default_hashtags_x: string;
  default_hashtags_facebook: string;
  default_hashtags_instagram: string;
  default_hashtags_linkedin: string;
  default_hashtags_tiktok: string;
  default_hashtags_youtube: string;
  default_website_url: string;
}

const emptySettings: DefaultSettings = {
  ai_suffix_x: "(ai)",
  ai_suffix_facebook: "",
  ai_suffix_instagram: "",
  ai_suffix_linkedin: "",
  ai_suffix_tiktok: "",
  ai_suffix_youtube: "",
  default_hashtags_x: "",
  default_hashtags_facebook: "",
  default_hashtags_instagram: "",
  default_hashtags_linkedin: "",
  default_hashtags_tiktok: "",
  default_hashtags_youtube: "",
  default_website_url: "",
};

export const AdminDefaultSettings = () => {
  const [settings, setSettings] = useState<DefaultSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "default_user_settings")
        .maybeSingle();

      if (error) {
        console.error("Error fetching admin settings:", error);
      }

      if (data?.setting_value) {
        const v = data.setting_value;
        setSettings({
          ai_suffix_x: v.ai_suffix_x ?? "(ai)",
          ai_suffix_facebook: v.ai_suffix_facebook ?? "",
          ai_suffix_instagram: v.ai_suffix_instagram ?? "",
          ai_suffix_linkedin: v.ai_suffix_linkedin ?? "",
          ai_suffix_tiktok: v.ai_suffix_tiktok ?? "",
          ai_suffix_youtube: v.ai_suffix_youtube ?? "",
          default_hashtags_x: v.default_hashtags_x ?? "",
          default_hashtags_facebook: v.default_hashtags_facebook ?? "",
          default_hashtags_instagram: v.default_hashtags_instagram ?? "",
          default_hashtags_linkedin: v.default_hashtags_linkedin ?? "",
          default_hashtags_tiktok: v.default_hashtags_tiktok ?? "",
          default_hashtags_youtube: v.default_hashtags_youtube ?? "",
          default_website_url: v.default_website_url ?? "",
        });
      }
    } catch (err) {
      console.error("Error in fetchSettings:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("admin_settings")
        .upsert(
          {
            setting_key: "default_user_settings",
            setting_value: settings,
          },
          { onConflict: "setting_key" }
        );

      if (error) {
        console.error("Error saving admin settings:", error);
        toast.error("Błąd podczas zapisywania ustawień");
        return;
      }

      toast.success("Domyślne ustawienia zapisane");
    } catch (err) {
      console.error("Error in saveSettings:", err);
      toast.error("Wystąpił błąd podczas zapisywania");
    } finally {
      setSaving(false);
    }
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

  const updateField = (field: keyof DefaultSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Domyślne ustawienia użytkowników
        </CardTitle>
        <CardDescription>
          Te ustawienia będą używane jako wartości domyślne dla nowych użytkowników, którzy nie mają własnych ustawień.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Suffixes */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Sufiksy AI (dodawane do postów)</h4>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {([
              ["ai_suffix_x", "X (Twitter)"],
              ["ai_suffix_facebook", "Facebook"],
              ["ai_suffix_instagram", "Instagram"],
              ["ai_suffix_linkedin", "LinkedIn"],
              ["ai_suffix_tiktok", "TikTok"],
              ["ai_suffix_youtube", "YouTube"],
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={settings[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  placeholder="np. (ai)"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Default Hashtags */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Domyślne hashtagi (dodawane do postów)</h4>
          <p className="text-xs text-muted-foreground">
            Hashtagi dodawane automatycznie do postów. Użytkownik może je nadpisać w swoich ustawieniach.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {([
              ["default_hashtags_x", "X (Twitter)"],
              ["default_hashtags_facebook", "Facebook"],
              ["default_hashtags_instagram", "Instagram"],
              ["default_hashtags_linkedin", "LinkedIn"],
              ["default_hashtags_tiktok", "TikTok"],
              ["default_hashtags_youtube", "YouTube"],
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={settings[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  placeholder="np. #książki #antykwariat"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Default URL */}
        <div className="space-y-2">
          <Label htmlFor="default_website_url">Domyślny URL strony</Label>
          <Input
            id="default_website_url"
            type="url"
            value={settings.default_website_url}
            onChange={(e) => updateField("default_website_url", e.target.value)}
            placeholder="https://sklep.antyk.org.pl"
          />
          <p className="text-xs text-muted-foreground">
            Ten URL będzie używany jako fallback, gdy książka nie ma własnego product_url
          </p>
        </div>

        <Button onClick={saveSettings} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Zapisywanie...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Zapisz domyślne ustawienia
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
