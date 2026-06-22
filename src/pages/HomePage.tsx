import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import {
  BookOpen,
  Calendar,
  BarChart3,
  Zap,
  Share2,
  LogIn,
} from "lucide-react";

const platforms = [
  { name: "X (Twitter)", icon: "𝕏" },
  { name: "Facebook", icon: "f" },
  { name: "Instagram", icon: "📷" },
  { name: "TikTok", icon: "♪" },
  { name: "YouTube", icon: "▶" },
  { name: "LinkedIn", icon: "in" },
  
  { name: "Bluesky", icon: "🦋" },
  { name: "Mastodon", icon: "🐘" },
  { name: "Telegram", icon: "✈" },
  { name: "Discord", icon: "💬" },
  { name: "Tumblr", icon: "t" },
  { name: "Google Business", icon: "G" },
];

const steps = [
  {
    icon: BookOpen,
    title: "Dodaj produkty",
    description:
      "Importuj książki z pliku XML lub CSV, albo dodaj je ręcznie. System automatycznie pobierze opisy i zdjęcia.",
  },
  {
    icon: Calendar,
    title: "Zaplanuj kampanię",
    description:
      "Twórz kampanie marketingowe z pomocą AI. Wybierz platformy, harmonogram i rodzaje postów.",
  },
  {
    icon: Share2,
    title: "Publikuj automatycznie",
    description:
      "Social Auto Flow opublikuje posty na wybranych platformach w zaplanowanych godzinach — bez Twojej ingerencji.",
  },
  {
    icon: BarChart3,
    title: "Monitoruj wyniki",
    description:
      "Śledź publikacje, limity platform i status kampanii w jednym przejrzystym panelu.",
  },
];

const HomePage = () => {
  const [authState, setAuthState] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(session ? "in" : "out");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthState(session ? "in" : "out");
    });
    return () => subscription.unsubscribe();
  }, []);

  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (authState === "in") return <Navigate to="/dashboard" replace />;
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Social Auto Flow</title>
        <meta
          name="description"
          content="Social Auto Flow automatyzuje publikację w mediach społecznościowych dla księgarni. Publikuj na Facebooku, Instagramie, X, TikToku, YouTube i wielu innych platformach."
        />
      </Helmet>

      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">
              Social Auto Flow
            </span>
          </div>
          <Button asChild>
            <Link to="/login">
              <LogIn className="mr-2 h-4 w-4" />
              Zaloguj się
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1">
        <div className="container mx-auto px-4 py-20 text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            Automatyzacja publikacji w mediach społecznościowych
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Social Auto Flow pozwala zaplanować i automatycznie opublikować
            posty na ponad 13 platformach społecznościowych — jednocześnie,
            bez ręcznej pracy.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" asChild>
              <Link to="/login">Rozpocznij</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">Jak to działa?</a>
            </Button>
          </div>
        </div>

        {/* How it works */}
        <div
          id="how-it-works"
          className="bg-muted/50 border-y border-border py-16"
        >
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-12">
              Jak to działa?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="text-center p-6 rounded-xl bg-background border border-border"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-4">
                    <step.icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Platforms */}
        <div className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-4">
              Obsługiwane platformy
            </h2>
            <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">
              Publikuj na wszystkich głównych platformach społecznościowych z
              jednego miejsca.
            </p>
            <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
              {platforms.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground"
                >
                  <span className="text-lg">{p.icon}</span>
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-primary/5 border-y border-border py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Gotowy, aby zautomatyzować swoją obecność w social media?
            </h2>
            <Button size="lg" asChild>
              <Link to="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Zaloguj się do panelu
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
