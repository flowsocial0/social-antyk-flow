import { Card } from "@/components/ui/card";
import { Linkedin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const LinkedInPlatformContent = () => {
  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Linkedin className="h-6 w-6 text-blue-700" />
            <h3 className="text-xl font-semibold">LinkedIn</h3>
          </div>
          <Badge variant="outline">Wkrótce</Badge>
        </div>
        
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Integracja z LinkedIn w przygotowaniu
          </p>
        </div>
      </Card>
    </div>
  );
};
