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
  ai_suffix_tiktok: string;
  ai_suffix_youtube: string;
  default_website_url: string;
}

const emptySettings: DefaultSettings = {
  ai_suffix_x: "(ai)",
  ai_suffix_facebook: "",
  ai_suffix_instagram: "",
  ai_suffix_tiktok: "",
  ai_suffix_youtube: "",
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
        setSettings({
          ai_suffix_x: data.setting_value.ai_suffix_x ?? "(ai)",
          ai_suffix_facebook: data.setting_value.ai_suffix_facebook ?? "",
          ai_suffix_instagram: data.setting_value.ai_suffix_instagram ?? "",
          ai_suffix_tiktok: data.setting_value.ai_suffix_tiktok ?? "",
          ai_suffix_youtube: data.setting_value.ai_suffix_youtube ?? "",
          default_website_url: data.setting_value.default_website_url ?? "",
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
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Sufiksy AI (dodawane do postów)</h4>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ai_suffix_x">X (Twitter)</Label>
              <Input
                id="ai_suffix_x"
                value={settings.ai_suffix_x}
                onChange={(e) => setSettings({ ...settings, ai_suffix_x: e.target.value })}
                placeholder="np. (ai)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_suffix_facebook">Facebook</Label>
              <Input
                id="ai_suffix_facebook"
                value={settings.ai_suffix_facebook}
                onChange={(e) => setSettings({ ...settings, ai_suffix_facebook: e.target.value })}
                placeholder="np. (ai)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_suffix_instagram">Instagram</Label>
              <Input
                id="ai_suffix_instagram"
                value={settings.ai_suffix_instagram}
                onChange={(e) => setSettings({ ...settings, ai_suffix_instagram: e.target.value })}
                placeholder="np. (ai)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_suffix_tiktok">TikTok</Label>
              <Input
                id="ai_suffix_tiktok"
                value={settings.ai_suffix_tiktok}
                onChange={(e) => setSettings({ ...settings, ai_suffix_tiktok: e.target.value })}
                placeholder="np. (ai)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_suffix_youtube">YouTube</Label>
              <Input
                id="ai_suffix_youtube"
                value={settings.ai_suffix_youtube}
                onChange={(e) => setSettings({ ...settings, ai_suffix_youtube: e.target.value })}
                placeholder="np. (ai)"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_website_url">Domyślny URL strony</Label>
          <Input
            id="default_website_url"
            type="url"
            value={settings.default_website_url}
            onChange={(e) => setSettings({ ...settings, default_website_url: e.target.value })}
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
