import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Upload, Calendar, RefreshCw, Download, Sparkles, Share2, ChevronDown, FileDown, Zap } from "lucide-react";
import { ImportCSVDialog } from "@/components/books/ImportCSVDialog";
import { AddBookDialog } from "@/components/books/AddBookDialog";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateCSVTemplate, generateXMLTemplate, downloadTemplate } from "@/lib/templates";

export const QuickActions = () => {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addBookDialogOpen, setAddBookDialogOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const syncBooksMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-books-from-xml");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["general-books"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      const stats = data.stats;
      toast.success(`Synchronizacja zakończona`, {
        description: `Dodano: ${stats.inserted}, Zaktualizowano: ${stats.updated}, Usunięto: ${stats.deleted} (z ${stats.xmlBooksFound} w XML)`,
      });
    },
    onError: (error: any) => {
      toast.error("Błąd synchronizacji", {
        description: error.message,
      });
    },
  });

  const loadXmlBooksMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("load-xml-books");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Dane załadowane`, {
        description: `Załadowano ${data.stats.booksLoaded} książek z XML`,
      });
    },
    onError: (error: any) => {
      toast.error("Błąd ładowania", {
        description: error.message,
      });
    },
  });

  const handleDownloadCSVTemplate = () => {
    const content = generateCSVTemplate();
    downloadTemplate(content, "szablon-ksiazki.csv", "text/csv;charset=utf-8;");
    toast.success("Szablon CSV został pobrany");
  };

  const handleDownloadXMLTemplate = () => {
    const content = generateXMLTemplate();
    downloadTemplate(content, "szablon-ksiazki.xml", "application/xml;charset=utf-8;");
    toast.success("Szablon XML został pobrany");
  };

  const launchExpressCampaign = async () => {
    try {
      // Check connected platforms
      const { data: xData } = await supabase.from('twitter_oauth_tokens').select('id').limit(1).maybeSingle();
      const { data: fbData } = await supabase.from('facebook_oauth_tokens').select('id').limit(1).maybeSingle();
      
      if (!xData && !fbData) {
        toast.error("Brak połączonych platform", {
          description: "Połącz najpierw X lub Facebook aby uruchomić kampanię"
        });
        return;
      }

      toast.loading("Tworzenie kampanii Express...", { id: "express-campaign" });

      // Calculate dates
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1); // Start tomorrow
      startDate.setHours(8, 0, 0, 0);

      const campaigns = [];

      // Create X campaign if connected
      if (xData) {
        const xPostingTimes = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00"];
        const xTotalPosts = 9 * 30; // 9 posts/day * 30 days
        const xContentPosts = Math.floor(xTotalPosts * 0.8);
        const xSalesPosts = xTotalPosts - xContentPosts;

        const xCampaignData = {
          name: `Kampania Express X - ${new Date().toLocaleDateString('pl-PL')}`,
          description: "Automatycznie wygenerowana kampania miesięczna dla platformy X",
          duration_days: 30,
          posts_per_day: 9,
          content_posts_count: xContentPosts,
          sales_posts_count: xSalesPosts,
          posting_times: xPostingTimes,
          start_date: startDate.toISOString(),
          target_platforms: ["x"],
          status: "draft"
        };

        const { data: xCampaign, error: xError } = await supabase
          .from('campaigns')
          .insert(xCampaignData)
          .select()
          .single();

        if (!xError && xCampaign) {
          campaigns.push({ id: xCampaign.id, platform: 'x', postsPerDay: 9 });
        }
      }

      // Create Facebook campaign if connected
      if (fbData) {
        const fbPostingTimes = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);
        const fbTotalPosts = 24 * 30; // 24 posts/day * 30 days
        const fbContentPosts = Math.floor(fbTotalPosts * 0.8);
        const fbSalesPosts = fbTotalPosts - fbContentPosts;

        const fbCampaignData = {
          name: `Kampania Express Facebook - ${new Date().toLocaleDateString('pl-PL')}`,
          description: "Automatycznie wygenerowana kampania miesięczna dla Facebooka",
          duration_days: 30,
          posts_per_day: 24,
          content_posts_count: fbContentPosts,
          sales_posts_count: fbSalesPosts,
          posting_times: fbPostingTimes,
          start_date: startDate.toISOString(),
          target_platforms: ["facebook"],
          status: "draft"
        };

        const { data: fbCampaign, error: fbError } = await supabase
          .from('campaigns')
          .insert(fbCampaignData)
          .select()
          .single();

        if (!fbError && fbCampaign) {
          campaigns.push({ id: fbCampaign.id, platform: 'facebook', postsPerDay: 24 });
        }
      }

      if (campaigns.length === 0) {
        toast.error("Nie udało się utworzyć kampanii", { id: "express-campaign" });
        return;
      }

      toast.success(`Utworzono ${campaigns.length} kampanię/kampanie Express`, {
        id: "express-campaign",
        description: "Przekierowywanie do automatycznego uruchomienia..."
      });

      // Redirect to launch page with campaign IDs
      const campaignIdsParam = campaigns.map(c => c.id).join(',');
      navigate(`/express-campaign-launch?campaigns=${campaignIdsParam}`);
    } catch (error) {
      console.error("Error creating express campaign:", error);
      toast.error("Błąd podczas tworzenia kampanii", {
        id: "express-campaign",
        description: error instanceof Error ? error.message : "Nieznany błąd"
      });
    }
  };

  const actions = [
    {
      icon: Zap,
      label: "Kampania Express",
      description: "Miesiąc na wszystkich platformach",
      variant: "default" as const,
      onClick: launchExpressCampaign,
    },
    {
      icon: Share2,
      label: "Platformy społecznościowe",
      description: "Zarządzaj wszystkimi platformami",
      variant: "default" as const,
      onClick: () => navigate("/platforms"),
    },
    {
      icon: Sparkles,
      label: "Kampania AI",
      description: "Plan 80/20",
      variant: "default" as const,
      onClick: () => navigate("/campaigns"),
    },
    {
      icon: Calendar,
      label: "Harmonogram zbiorczy",
      description: "Zobacz wszystkie zaplanowane posty",
      variant: "secondary" as const,
      onClick: () => navigate("/schedule-overview"),
    },
    {
      icon: RefreshCw,
      label: "Synchronizuj dane",
      description: "Pobierz dane z XML",
      variant: "secondary" as const,
      onClick: () => syncBooksMutation.mutate(),
      loading: syncBooksMutation.isPending,
    },
  ];

  return (
    <>
      {/* Quick Actions */}
      <Card className="p-6 bg-gradient-card border-border/50 shadow-card">
        <h2 className="text-xl font-semibold mb-6">Szybkie akcje</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Book Management Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" className="h-full flex-col items-start p-4 gap-2">
                <div className="flex items-center gap-2 w-full">
                  <Plus className="h-5 w-5 flex-shrink-0" />
                  <span className="font-semibold">Dodaj książki</span>
                  <ChevronDown className="h-4 w-4 ml-auto" />
                </div>
                <span className="text-xs text-muted-foreground text-left">Zarządzaj książkami</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => setAddBookDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Ręcznie
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importuj CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => loadXmlBooksMutation.mutate()}>
                <Download className="mr-2 h-4 w-4" />
                Załaduj z XML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadCSVTemplate}>
                <FileDown className="mr-2 h-4 w-4" />
                Pobierz szablon CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadXMLTemplate}>
                <FileDown className="mr-2 h-4 w-4" />
                Pobierz szablon XML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Other actions */}
          {actions.map((action, index) => {
            const Icon = action.icon;
            const hasOnClick = "onClick" in action;
            const isLoading = "loading" in action && action.loading;
            
            return (
              <Button
                key={index}
                variant={action.variant}
                className="h-auto flex-col items-start p-6 space-y-2 hover:shadow-glow transition-all duration-300"
                onClick={hasOnClick ? action.onClick : undefined}
                disabled={isLoading}
              >
                <Icon className={`h-8 w-8 mb-2 ${isLoading ? "animate-spin" : ""}`} />
                <span className="font-semibold text-base">{action.label}</span>
                <span className="text-xs opacity-70 font-normal">{action.description}</span>
              </Button>
            );
          })}
        </div>
      </Card>

      <ImportCSVDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      <AddBookDialog 
        open={addBookDialogOpen} 
        onOpenChange={setAddBookDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["general-books"] })}
      />
    </>
  );
};
