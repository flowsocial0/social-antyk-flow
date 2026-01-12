import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Calendar, 
  Share2, 
  BookOpen, 
  Clock, 
  Zap, 
  BarChart3,
  Facebook,
  Twitter
} from "lucide-react";

const LandingPage = () => {
  const features = [
    {
      icon: Calendar,
      title: "Automatyczne planowanie",
      description: "Zaplanuj posty z wyprzedzeniem i publikuj automatycznie o wybranej porze."
    },
    {
      icon: Share2,
      title: "Wiele platform",
      description: "Publikuj jednocześnie na Facebook, X (Twitter), TikTok i innych platformach."
    },
    {
      icon: BookOpen,
      title: "Promocja książek",
      description: "Specjalizujemy się w promocji książek i produktów księgarskich."
    },
    {
      icon: Clock,
      title: "Oszczędność czasu",
      description: "Zaplanuj kampanie raz i pozwól systemowi działać za Ciebie."
    },
    {
      icon: Zap,
      title: "AI-generowane treści",
      description: "Sztuczna inteligencja pomoże Ci tworzyć angażujące opisy produktów."
    },
    {
      icon: BarChart3,
      title: "Analityka",
      description: "Śledź skuteczność swoich postów i optymalizuj kampanie."
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-gradient-primary">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary-foreground">Social Auto Flow</h1>
            <Link to="/login">
              <Button variant="secondary">Zaloguj się</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-primary py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Automatyzacja mediów społecznościowych
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Zaplanuj, twórz i publikuj posty na wielu platformach społecznościowych. 
            Idealne rozwiązanie dla księgarń, wydawców i autorów.
          </p>
          <div className="flex items-center justify-center gap-4 mb-8">
            <Facebook className="h-8 w-8 text-primary-foreground/80" />
            <Twitter className="h-8 w-8 text-primary-foreground/80" />
          </div>
          <Link to="/login">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Rozpocznij teraz
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">
            Co oferujemy?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border">
                <CardContent className="pt-6">
                  <feature.icon className="h-12 w-12 text-primary mb-4" />
                  <h4 className="text-xl font-semibold text-foreground mb-2">
                    {feature.title}
                  </h4>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Gotowy, aby zautomatyzować swoje media społecznościowe?
          </h3>
          <p className="text-muted-foreground mb-6">
            Dołącz do Social Auto Flow i zacznij oszczędzać czas już dziś.
          </p>
          <Link to="/login">
            <Button size="lg" className="text-lg px-8">
              Zaloguj się
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Social Auto Flow. Wszelkie prawa zastrzeżone.
            </p>
            <nav className="flex items-center gap-6 text-sm">
              <Link 
                to="/terms" 
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Regulamin
              </Link>
              <Link 
                to="/privacy" 
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Polityka Prywatności
              </Link>
              <Link 
                to="/data-deletion" 
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Usuwanie danych
              </Link>
            </nav>
          </div>
          <div className="mt-4 text-center md:text-left">
            <p className="text-sm text-muted-foreground">
              Kontakt: <a href="mailto:kontakt@socialautoflow.pl" className="hover:text-foreground">kontakt@socialautoflow.pl</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
