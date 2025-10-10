import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Upload, Calendar, Settings } from "lucide-react";
import { ImportCSVDialog } from "@/components/books/ImportCSVDialog";

export const QuickActions = () => {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const actions = [
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
      icon: Calendar,
      label: "Zaplanuj posty",
      description: "Zaplanuj kampanię",
      variant: "secondary" as const
    },
    {
      icon: Settings,
      label: "Połącz platformy",
      description: "Połącz konta społecznościowe",
      variant: "secondary" as const
    }
  ];

  return (
    <>
      <Card className="p-6 bg-gradient-card border-border/50 shadow-card">
        <h2 className="text-xl font-semibold mb-6">Szybkie akcje</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const isImportAction = index === 1; // "Importuj CSV" button
            return (
              <Button
                key={index}
                variant={action.variant}
                className="h-auto flex-col items-start p-6 space-y-2 hover:shadow-glow transition-all duration-300"
                onClick={isImportAction ? () => setImportDialogOpen(true) : undefined}
              >
                <Icon className="h-8 w-8 mb-2" />
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
