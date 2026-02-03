import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Trash2, Mail, Shield, ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet";
import { Footer } from "@/components/layout/Footer";

const DataDeletion = () => {
  const [searchParams] = useSearchParams();
  const confirmationCode = searchParams.get('confirmation');

  // If there's a confirmation code, show the confirmation view
  if (confirmationCode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Helmet>
            <title>Potwierdzenie usunięcia danych - Social Auto Flow</title>
          </Helmet>
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle>Potwierdzenie usunięcia danych</CardTitle>
              <CardDescription>
                Twoje dane zostały pomyślnie usunięte z naszego systemu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Wszystkie Twoje dane połączone z Facebook zostały trwale usunięte zgodnie z wymogami Meta.</p>
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="font-mono text-xs break-all">
                    <strong>Kod potwierdzenia:</strong> {confirmationCode}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Default view - Data deletion instructions
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Usuwanie danych użytkownika - Social Auto Flow</title>
        <meta name="description" content="Instrukcje dotyczące usuwania danych użytkownika z aplikacji Social Auto Flow" />
      </Helmet>
      
      <main className="flex-1 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Powrót do strony głównej
              </Link>
            </Button>
          </div>
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Shield className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Usuwanie danych użytkownika</h1>
            <p className="text-muted-foreground">
              SocialAutoFlow szanuje Twoją prywatność i daje Ci pełną kontrolę nad Twoimi danymi
            </p>
          </div>

          <div className="space-y-6">
            {/* What data we store */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Jakie dane przechowujemy?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>Gdy łączysz swoje konto z naszą aplikacją, przechowujemy następujące dane:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Token dostępu do Twojego konta (niezbędny do publikowania postów)</li>
                  <li>Identyfikator Twojej strony/konta</li>
                  <li>Nazwę Twojej strony/konta</li>
                  <li>Zaplanowane posty i ich treść</li>
                </ul>
              </CardContent>
            </Card>

            {/* How to delete data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Jak usunąć swoje dane?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h3 className="font-semibold mb-2">Opcja 1: Odłączenie konta w aplikacji</h3>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Zaloguj się do Social Auto Flow</li>
                    <li>Przejdź do Ustawień kont społecznościowych</li>
                    <li>Znajdź połączone konto (Facebook, X/Twitter, TikTok itp.)</li>
                    <li>Kliknij "Rozłącz" lub "Disconnect"</li>
                    <li>Twoje dane zostaną natychmiast usunięte z naszych serwerów</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Opcja 2: Usunięcie przez platformę społecznościową</h3>
                  <p className="text-muted-foreground mb-2">
                    Możesz również usunąć dostęp naszej aplikacji bezpośrednio z ustawień platformy:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>Facebook:</strong> Ustawienia → Aplikacje i witryny → Usuń Social Auto Flow</li>
                    <li><strong>X (Twitter):</strong> Ustawienia → Bezpieczeństwo i dostęp → Aplikacje → Cofnij dostęp</li>
                    <li><strong>TikTok:</strong> Ustawienia → Bezpieczeństwo → Zarządzaj uprawnieniami aplikacji</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    Po usunięciu dostępu z platformy, Twoje dane w naszej aplikacji zostaną automatycznie usunięte.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Opcja 3: Kontakt bezpośredni</h3>
                  <p className="text-muted-foreground">
                    Jeśli masz trudności z usunięciem danych lub potrzebujesz pomocy, skontaktuj się z nami:
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Mail className="h-4 w-4" />
                    <a href="mailto:flowsocial0@gmail.com" className="text-primary hover:underline">
                      flowsocial0@gmail.com
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What happens after deletion */}
            <Card>
              <CardHeader>
                <CardTitle>Co się dzieje po usunięciu danych?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <ul className="list-disc list-inside space-y-1">
                  <li>Wszystkie Twoje tokeny dostępu są natychmiast unieważniane</li>
                  <li>Dane Twojego konta są trwale usuwane z naszej bazy danych</li>
                  <li>Zaplanowane posty dla tego konta są anulowane</li>
                  <li>Nie przechowujemy żadnych kopii zapasowych Twoich danych po usunięciu</li>
                </ul>
                <p className="mt-4">
                  Proces usunięcia danych jest natychmiastowy i nieodwracalny.
                </p>
              </CardContent>
            </Card>

            {/* Additional links */}
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Link to="/privacy" className="text-primary hover:underline text-sm">
                Polityka Prywatności SocialAutoFlow
              </Link>
              <Link to="/terms" className="text-primary hover:underline text-sm">
                Regulamin SocialAutoFlow
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default DataDeletion;
