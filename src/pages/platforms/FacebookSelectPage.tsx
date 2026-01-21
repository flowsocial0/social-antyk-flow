import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Facebook, CheckCircle, AlertCircle, CheckSquare } from "lucide-react";
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
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
      setUserId(session.user.id);
      
      const sessionId = searchParams.get("session_id");
      
      // Legacy support: check for old base64 pages parameter
      const pagesParam = searchParams.get("pages");
      const userIdParam = searchParams.get("user_id");

      if (pagesParam && userIdParam) {
        // Legacy base64 decoding for backwards compatibility
        try {
          const decodedPages = JSON.parse(decodeURIComponent(atob(pagesParam)));
          setPages(decodedPages);
          // Pre-select all pages by default
          setSelectedPages(new Set(decodedPages.map((p: FacebookPage) => p.id)));
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

        const pagesData = data.pages_data as unknown as FacebookPage[];
        setPages(pagesData);
        // Pre-select all pages by default
        setSelectedPages(new Set(pagesData.map(p => p.id)));
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading pages:", err);
        setError("Nieoczekiwany błąd podczas ładowania stron.");
        setIsLoading(false);
      }
    };

    fetchPagesData();
  }, [searchParams, navigate]);

  const handleTogglePage = (pageId: string) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPages.size === pages.length) {
      // Deselect all
      setSelectedPages(new Set());
    } else {
      // Select all
      setSelectedPages(new Set(pages.map(p => p.id)));
    }
  };

  const handleSaveSelectedPages = async () => {
    if (selectedPages.size === 0) {
      toast.error("Wybierz przynajmniej jedną stronę");
      return;
    }

    if (!userId) {
      toast.error("Nie jesteś zalogowany");
      return;
    }

    setIsSaving(true);

    try {
      const selectedPagesData = pages
        .filter(p => selectedPages.has(p.id))
        .map(p => ({
          id: p.id,
          name: p.name,
          access_token: p.access_token
        }));

      const { data, error } = await supabase.functions.invoke("facebook-select-page", {
        body: {
          userId,
          pages: selectedPagesData
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const count = selectedPagesData.length;
      toast.success(`Połączono ${count} ${count === 1 ? 'stronę' : count < 5 ? 'strony' : 'stron'} Facebook!`);
      navigate("/platforms/facebook?connected=true&count=" + count);
    } catch (err: any) {
      console.error("Error saving pages:", err);
      toast.error(err.message || "Błąd podczas zapisywania stron");
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
          <CardTitle>Wybierz strony Facebook</CardTitle>
          <CardDescription>
            Masz dostęp do {pages.length} stron. Możesz wybrać wiele stron jednocześnie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Select All button */}
          <button
            onClick={handleSelectAll}
            disabled={isSaving}
            className="w-full p-3 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
          >
            <CheckSquare className="h-4 w-4" />
            {selectedPages.size === pages.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
          </button>

          {pages.map((page) => {
            const isSelected = selectedPages.has(page.id);
            return (
              <button
                key={page.id}
                onClick={() => handleTogglePage(page.id)}
                disabled={isSaving}
                className={`
                  w-full p-4 rounded-lg border text-left transition-all
                  ${isSelected 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }
                  ${isSaving ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleTogglePage(page.id)}
                    disabled={isSaving}
                    className="pointer-events-none"
                  />
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
                  {isSelected && (
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              </button>
            );
          })}

          <div className="pt-4 border-t space-y-2">
            <Button
              onClick={handleSaveSelectedPages}
              disabled={isSaving || selectedPages.size === 0}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Łączenie...
                </>
              ) : (
                `Połącz ${selectedPages.size} ${selectedPages.size === 1 ? 'stronę' : selectedPages.size < 5 ? 'strony' : 'stron'}`
              )}
            </Button>
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
