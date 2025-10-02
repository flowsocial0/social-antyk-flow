import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Upload, Calendar, Settings } from "lucide-react";

export const QuickActions = () => {
  const actions = [
    {
      icon: Plus,
      label: "Add Book",
      description: "Manually add a new book",
      variant: "default" as const
    },
    {
      icon: Upload,
      label: "Import CSV",
      description: "Bulk import from file",
      variant: "secondary" as const
    },
    {
      icon: Calendar,
      label: "Schedule Posts",
      description: "Plan your campaign",
      variant: "secondary" as const
    },
    {
      icon: Settings,
      label: "Connect Platforms",
      description: "Link social accounts",
      variant: "secondary" as const
    }
  ];

  return (
    <Card className="p-6 bg-gradient-card border-border/50">
      <h2 className="text-xl font-semibold mb-6">Quick Actions</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant}
              className="h-auto flex-col items-start p-6 space-y-2 hover:shadow-glow transition-all duration-300"
            >
              <Icon className="h-8 w-8 mb-2" />
              <span className="font-semibold text-base">{action.label}</span>
              <span className="text-xs opacity-70 font-normal">{action.description}</span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
};
