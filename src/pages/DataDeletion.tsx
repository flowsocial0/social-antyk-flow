import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

const DataDeletion = () => {
  const [searchParams] = useSearchParams();
  const confirmationCode = searchParams.get('confirmation');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
            <p>Wszystkie Twoje dane połączone z Facebook zostały trwale usunięte zgodnie z wymogami Facebook.</p>
            {confirmationCode && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="font-mono text-xs break-all">
                  <strong>Kod potwierdzenia:</strong> {confirmationCode}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataDeletion;
