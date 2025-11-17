import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Upload, Calendar, RefreshCw, Download, Sparkles, Share2, ChevronDown, FileDown } from "lucide-react";
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
      toast.success(`Synchronizacja zakończona`, {
        description: `Zaktualizowano ${data.stats.updated} książek z ${data.stats.xmlBooksFound} dostępnych`,
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
