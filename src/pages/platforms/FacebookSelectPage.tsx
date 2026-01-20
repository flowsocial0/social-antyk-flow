import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Facebook, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface FacebookPage {
  id: string;
  name: string;
  category: string | null;
  access_token: string;
}

export default function FacebookSelectPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPagesData = async () => {
      // First verify user session is still active after OAuth redirect
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.error('User session not found on FacebookSelectPage - redirecting to login');
        setError("Sesja wygasła podczas łączenia z Facebookiem. Zaloguj się ponownie i spróbuj połączyć konto Facebook.");
        setIsLoading(false);
        // Redirect to login with return path
        setTimeout(() => {
          navigate('/login?redirect=/platforms/facebook');
        }, 3000);
        return;
      }
      
      console.log('Session verified for user:', session.user.id);
      
      const sessionId = searchParams.get("session_id");
      
      // Legacy support: check for old base64 pages parameter
      const pagesParam = searchParams.get("pages");
      const userIdParam = searchParams.get("user_id");

      if (pagesParam && userIdParam) {
        // Legacy base64 decoding for backwards compatibility
        try {
          const decodedPages = JSON.parse(decodeURIComponent(atob(pagesParam)));
          setPages(decodedPages);
          setIsLoading(false);
          return;
        } catch (err) {
          console.error("Error parsing legacy pages data:", err);
        }
      }

      if (!sessionId) {
        setError("Brak identyfikatora sesji. Spróbuj połączyć się ponownie z Facebookiem.");
        setIsLoading(false);
        return;
      }

      try {
        // Fetch pages data from database using session_id
        const { data, error: fetchError } = await supabase
          .from('facebook_page_selections')
          .select('pages_data, user_id, expires_at')
          .eq('id', sessionId)
          .maybeSingle();

        if (fetchError) {
          console.error("Error fetching page selections:", fetchError);
          setError("Błąd podczas pobierania danych stron.");
          setIsLoading(false);
          return;
        }

        if (!data) {
          setError("Sesja wygasła lub nie istnieje. Spróbuj połączyć się ponownie z Facebookiem.");
          setIsLoading(false);
          return;
        }

        // Check if session expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setError("Sesja wygasła. Spróbuj połączyć się ponownie z Facebookiem.");
          setIsLoading(false);
          return;
        }

        setPages(data.pages_data as unknown as FacebookPage[]);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading pages:", err);
        setError("Nieoczekiwany błąd podczas ładowania stron.");
        setIsLoading(false);
      }
    };

    fetchPagesData();
  }, [searchParams]);

  const handleSelectPage = async (page: FacebookPage) => {
    setIsSaving(true);
    setSelectedPageId(page.id);

    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error("Nie jesteś zalogowany");
      }

      const { data, error } = await supabase.functions.invoke("facebook-select-page", {
        body: {
          userId: session.user.id,
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success(`Strona "${page.name}" została połączona!`);
      navigate("/platforms/facebook?connected=true&page_name=" + encodeURIComponent(page.name));
    } catch (err: any) {
      console.error("Error selecting page:", err);
      toast.error(err.message || "Błąd podczas zapisywania strony");
      setSelectedPageId(null);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Ładowanie stron...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-center text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/platforms/facebook")} className="mt-4">
              Wróć do ustawień Facebook
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-[#1877F2] flex items-center justify-center">
            <Facebook className="h-6 w-6 text-white" />
          </div>
          <CardTitle>Wybierz stronę Facebook</CardTitle>
          <CardDescription>
            Masz dostęp do {pages.length} stron. Wybierz tę, na której chcesz publikować posty.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => handleSelectPage(page)}
              disabled={isSaving}
              className={`
                w-full p-4 rounded-lg border text-left transition-all
                ${selectedPageId === page.id 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
                }
                ${isSaving && selectedPageId !== page.id ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {page.name}
                  </h3>
                  {page.category && (
                    <p className="text-sm text-muted-foreground truncate">
                      {page.category}
                    </p>
                  )}
                </div>
                {selectedPageId === page.id && isSaving && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary ml-2 flex-shrink-0" />
                )}
                {selectedPageId === page.id && !isSaving && (
                  <CheckCircle className="h-5 w-5 text-primary ml-2 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}

          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/platforms/facebook")}
              disabled={isSaving}
            >
              Anuluj
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
