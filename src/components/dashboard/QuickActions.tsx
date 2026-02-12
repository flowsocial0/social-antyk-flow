import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Upload, Calendar, RefreshCw, Download, Sparkles, Share2, ChevronDown, FileDown, Shield, Settings, FileCode, Video } from "lucide-react";
import { ImportCSVDialog } from "@/components/books/ImportCSVDialog";
import { ImportXMLDialog } from "@/components/books/ImportXMLDialog";
import { AddBookDialog } from "@/components/books/AddBookDialog";
import { BulkVideoUploadDialog } from "@/components/books/BulkVideoUploadDialog";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateCSVTemplate, generateXMLTemplate, downloadTemplate } from "@/lib/templates";
import { useUserRole } from "@/hooks/useUserRole";

// User ID allowed to use XML online features
const XML_ONLINE_ALLOWED_USER = "662824bf-77c0-4a1d-9113-2d2338bebb42";

export const QuickActions = () => {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importXMLDialogOpen, setImportXMLDialogOpen] = useState(false);
  const [addBookDialogOpen, setAddBookDialogOpen] = useState(false);
  const [bulkVideoOpen, setBulkVideoOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null);
    });
  }, []);

  const canUseXmlOnline = currentUserId === XML_ONLINE_ALLOWED_USER;

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

  const actions = [
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
      icon: Settings,
      label: "Ustawienia",
      description: "Dopiski AI, domyślny link",
      variant: "outline" as const,
      onClick: () => navigate("/settings"),
    },
  ];

  // Add admin tile if user is admin
  const adminAction = isAdmin ? {
    icon: Shield,
    label: "Administracja",
    description: "Panel administratora",
    variant: "destructive" as const,
    onClick: () => navigate("/admin"),
  } : null;

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
              <DropdownMenuItem onClick={() => setImportXMLDialogOpen(true)}>
                <FileCode className="mr-2 h-4 w-4" />
                Importuj XML
              </DropdownMenuItem>
              {canUseXmlOnline && (
                <DropdownMenuItem onClick={() => loadXmlBooksMutation.mutate()}>
                  <Download className="mr-2 h-4 w-4" />
                  Załaduj z XML (online)
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDownloadCSVTemplate}>
                <FileDown className="mr-2 h-4 w-4" />
                Pobierz szablon CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadXMLTemplate}>
                <FileDown className="mr-2 h-4 w-4" />
                Pobierz szablon XML
              </DropdownMenuItem>
              {canUseXmlOnline && (
                <DropdownMenuItem onClick={() => syncBooksMutation.mutate()} disabled={syncBooksMutation.isPending}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncBooksMutation.isPending ? "animate-spin" : ""}`} />
                  Synchronizuj z XML
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setBulkVideoOpen(true)}>
                <Video className="mr-2 h-4 w-4" />
                Masowy upload wideo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Other actions */}
          {actions.map((action, index) => {
            const Icon = action.icon;
            
            return (
              <Button
                key={index}
                variant={action.variant}
                className="h-auto flex-col items-start p-6 space-y-2 hover:shadow-glow transition-all duration-300"
                onClick={action.onClick}
              >
                <Icon className="h-8 w-8 mb-2" />
                <span className="font-semibold text-base">{action.label}</span>
                <span className="text-xs opacity-70 font-normal">{action.description}</span>
              </Button>
            );
          })}

          {/* Admin tile (only for admins) */}
          {!roleLoading && adminAction && (
            <Button
              variant={adminAction.variant}
              className="h-auto flex-col items-start p-6 space-y-2 hover:shadow-glow transition-all duration-300"
              onClick={adminAction.onClick}
            >
              <adminAction.icon className="h-8 w-8 mb-2" />
              <span className="font-semibold text-base">{adminAction.label}</span>
              <span className="text-xs opacity-70 font-normal">{adminAction.description}</span>
            </Button>
          )}
        </div>
      </Card>

      <ImportCSVDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      <ImportXMLDialog open={importXMLDialogOpen} onOpenChange={setImportXMLDialogOpen} />
      <AddBookDialog 
        open={addBookDialogOpen} 
        onOpenChange={setAddBookDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["general-books"] })}
      />
      <BulkVideoUploadDialog open={bulkVideoOpen} onOpenChange={setBulkVideoOpen} />
    </>
  );
};
