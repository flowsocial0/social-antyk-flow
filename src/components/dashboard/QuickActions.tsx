import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Upload, Calendar, Settings, RefreshCw, Download, Sparkles, Share2 } from "lucide-react";
import { ImportCSVDialog } from "@/components/books/ImportCSVDialog";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const QuickActions = () => {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const navigate = useNavigate();

  const syncBooksMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-books-from-xml');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synchronizacja zakończona`, {
        description: `Zaktualizowano ${data.stats.updated} książek z ${data.stats.xmlBooksFound} dostępnych`
      });
    },
    onError: (error: any) => {
      toast.error("Błąd synchronizacji", {
        description: error.message
      });
    }
  });

  const loadXmlBooksMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('load-xml-books');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Dane załadowane`, {
        description: `Załadowano ${data.stats.booksLoaded} książek z XML`
      });
    },
    onError: (error: any) => {
      toast.error("Błąd ładowania", {
        description: error.message
      });
    }
  });

  const actions = [
    {
      icon: Share2,
      label: "Platformy społecznościowe",
      description: "Zarządzaj wszystkimi platformami",
      variant: "default" as const,
      onClick: () => navigate('/platforms')
    },
    {
      icon: Plus,
      label: "Dodaj książkę",
      description: "Ręcznie dodaj nową książkę",
      variant: "default" as const
    },
    {
      icon: Upload,
      label: "Importuj CSV",
      description: "Masowy import z pliku",
      variant: "secondary" as const
    },
    {
      icon: Sparkles,
      label: "Kampania AI",
      description: "Plan 80/20 z Grok AI",
      variant: "secondary" as const,
      onClick: () => navigate('/campaigns')
    },
    {
      icon: Calendar,
      label: "Harmonogram zbiorczy",
      description: "Zobacz wszystkie zaplanowane posty",
      variant: "secondary" as const,
      onClick: () => navigate('/schedule-overview')
    },
    {
      icon: Settings,
      label: "Połącz platformy",
      description: "Połącz konta społecznościowe",
      variant: "secondary" as const
    },
    {
      icon: Download,
      label: "Załaduj XML",
      description: "Załaduj tytuły i linki z XML",
      variant: "secondary" as const,
      onClick: () => loadXmlBooksMutation.mutate(),
      loading: loadXmlBooksMutation.isPending
    },
    {
      icon: RefreshCw,
      label: "Synchronizuj dane",
      description: "Pobierz dane z XML",
      variant: "secondary" as const,
      onClick: () => syncBooksMutation.mutate(),
      loading: syncBooksMutation.isPending
    }
  ];

  return (
    <>
      {/* Quick Actions */}
      <Card className="p-6 bg-gradient-card border-border/50 shadow-card">
        <h2 className="text-xl font-semibold mb-6">Szybkie akcje</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const isImportAction = index === 1; // "Importuj CSV" button
            const isCampaignAction = index === 2; // "Kampania AI" button
            const isScheduleAction = index === 3; // "Harmonogram zbiorczy" button
            const isSyncAction = 'onClick' in action;
            return (
              <Button
                key={index}
                variant={action.variant}
                className="h-auto flex-col items-start p-6 space-y-2 hover:shadow-glow transition-all duration-300"
                onClick={
                  isImportAction 
                    ? () => setImportDialogOpen(true) 
                    : isSyncAction && action.onClick 
                    ? action.onClick 
                    : undefined
                }
                disabled={isSyncAction && action.loading}
              >
                <Icon className={`h-8 w-8 mb-2 ${isSyncAction && action.loading ? 'animate-spin' : ''}`} />
                <span className="font-semibold text-base">{action.label}</span>
                <span className="text-xs opacity-70 font-normal">{action.description}</span>
              </Button>
            );
          })}
        </div>
      </Card>
      
      <ImportCSVDialog 
        open={importDialogOpen} 
        onOpenChange={setImportDialogOpen} 
      />
    </>
  );
};
