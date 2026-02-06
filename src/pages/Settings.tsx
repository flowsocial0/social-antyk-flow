import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { useUserSettings } from "@/hooks/useUserSettings";
import type { User } from "@supabase/supabase-js";

const Settings = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();
  
  const { settings, loading, saving, saveSettings } = useUserSettings();
  
  // Form state - suffixes
  const [aiSuffixX, setAiSuffixX] = useState("");
  const [aiSuffixFacebook, setAiSuffixFacebook] = useState("");
  const [aiSuffixInstagram, setAiSuffixInstagram] = useState("");
  const [aiSuffixLinkedin, setAiSuffixLinkedin] = useState("");
  const [aiSuffixTiktok, setAiSuffixTiktok] = useState("");
  const [aiSuffixYoutube, setAiSuffixYoutube] = useState("");
  // Form state - hashtags
  const [hashtagsX, setHashtagsX] = useState("");
  const [hashtagsFacebook, setHashtagsFacebook] = useState("");
  const [hashtagsInstagram, setHashtagsInstagram] = useState("");
  const [hashtagsLinkedin, setHashtagsLinkedin] = useState("");
  const [hashtagsTiktok, setHashtagsTiktok] = useState("");
  const [hashtagsYoutube, setHashtagsYoutube] = useState("");
  const [defaultWebsiteUrl, setDefaultWebsiteUrl] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!loading) {
      setAiSuffixX(settings.ai_suffix_x);
      setAiSuffixFacebook(settings.ai_suffix_facebook);
      setAiSuffixInstagram(settings.ai_suffix_instagram);
      setAiSuffixLinkedin(settings.ai_suffix_linkedin);
      setAiSuffixTiktok(settings.ai_suffix_tiktok);
      setAiSuffixYoutube(settings.ai_suffix_youtube);
      setHashtagsX(settings.default_hashtags_x);
      setHashtagsFacebook(settings.default_hashtags_facebook);
      setHashtagsInstagram(settings.default_hashtags_instagram);
      setHashtagsLinkedin(settings.default_hashtags_linkedin);
      setHashtagsTiktok(settings.default_hashtags_tiktok);
      setHashtagsYoutube(settings.default_hashtags_youtube);
      setDefaultWebsiteUrl(settings.default_website_url);
    }
  }, [loading, settings]);

  const handleSave = async () => {
    await saveSettings({
      ai_suffix_x: aiSuffixX,
      ai_suffix_facebook: aiSuffixFacebook,
      ai_suffix_instagram: aiSuffixInstagram,
      ai_suffix_linkedin: aiSuffixLinkedin,
      ai_suffix_tiktok: aiSuffixTiktok,
      ai_suffix_youtube: aiSuffixYoutube,
      default_hashtags_x: hashtagsX,
      default_hashtags_facebook: hashtagsFacebook,
      default_hashtags_instagram: hashtagsInstagram,
      default_hashtags_linkedin: hashtagsLinkedin,
      default_hashtags_tiktok: hashtagsTiktok,
      default_hashtags_youtube: hashtagsYoutube,
      default_website_url: defaultWebsiteUrl,
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-gradient-primary shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-6 w-6 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground">Ustawienia</h1>
                <p className="text-sm text-primary-foreground/80">Konfiguracja konta i preferencje</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        {/* AI Suffixes */}
        <Card>
          <CardHeader>
            <CardTitle>Dopiski AI dla platform</CardTitle>
            <CardDescription>
              Tekst dodawany automatycznie na końcu postów generowanych przez AI dla każdej platformy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ai_suffix_x">X (Twitter)</Label>
                <Input id="ai_suffix_x" value={aiSuffixX} onChange={(e) => setAiSuffixX(e.target.value)} placeholder="np. (ai)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai_suffix_facebook">Facebook</Label>
                <Input id="ai_suffix_facebook" value={aiSuffixFacebook} onChange={(e) => setAiSuffixFacebook(e.target.value)} placeholder="np. #AIgenerated" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai_suffix_instagram">Instagram</Label>
                <Input id="ai_suffix_instagram" value={aiSuffixInstagram} onChange={(e) => setAiSuffixInstagram(e.target.value)} placeholder="np. #AI" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai_suffix_linkedin">LinkedIn</Label>
                <Input id="ai_suffix_linkedin" value={aiSuffixLinkedin} onChange={(e) => setAiSuffixLinkedin(e.target.value)} placeholder="np. (ai)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai_suffix_tiktok">TikTok</Label>
                <Input id="ai_suffix_tiktok" value={aiSuffixTiktok} onChange={(e) => setAiSuffixTiktok(e.target.value)} placeholder="np. #AIcontent" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai_suffix_youtube">YouTube</Label>
                <Input id="ai_suffix_youtube" value={aiSuffixYoutube} onChange={(e) => setAiSuffixYoutube(e.target.value)} placeholder="np. #AI" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Hashtags */}
        <Card>
          <CardHeader>
            <CardTitle>Domyślne hashtagi</CardTitle>
            <CardDescription>
              Hashtagi dodawane automatycznie do postów na każdej platformie. Zostaw puste, aby nie dodawać.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="hashtags_x">X (Twitter)</Label>
                <Input id="hashtags_x" value={hashtagsX} onChange={(e) => setHashtagsX(e.target.value)} placeholder="np. #książki" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashtags_facebook">Facebook</Label>
                <Input id="hashtags_facebook" value={hashtagsFacebook} onChange={(e) => setHashtagsFacebook(e.target.value)} placeholder="np. #książki #czytanie" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashtags_instagram">Instagram</Label>
                <Input id="hashtags_instagram" value={hashtagsInstagram} onChange={(e) => setHashtagsInstagram(e.target.value)} placeholder="np. #bookstagram" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashtags_linkedin">LinkedIn</Label>
                <Input id="hashtags_linkedin" value={hashtagsLinkedin} onChange={(e) => setHashtagsLinkedin(e.target.value)} placeholder="np. #books" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashtags_tiktok">TikTok</Label>
                <Input id="hashtags_tiktok" value={hashtagsTiktok} onChange={(e) => setHashtagsTiktok(e.target.value)} placeholder="np. #booktok" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashtags_youtube">YouTube</Label>
                <Input id="hashtags_youtube" value={hashtagsYoutube} onChange={(e) => setHashtagsYoutube(e.target.value)} placeholder="np. #books" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Website URL */}
        <Card>
          <CardHeader>
            <CardTitle>Domyślny link do strony</CardTitle>
            <CardDescription>
              Ten link zostanie użyty, gdy książka nie ma własnego URL produktu lub przy generowaniu ciekawostek.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="default_website_url">URL</Label>
              <Input
                id="default_website_url"
                type="text"
                value={defaultWebsiteUrl}
                onChange={(e) => setDefaultWebsiteUrl(e.target.value)}
                placeholder="np. https://sklep.antyk.org.pl"
              />
              <p className="text-xs text-muted-foreground">
                Podaj pełny adres URL z protokołem (https://)
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Zapisz ustawienia
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Settings;
