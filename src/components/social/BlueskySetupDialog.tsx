import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface BlueskySetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BlueskySetupDialog({ open, onOpenChange, onSuccess }: BlueskySetupDialogProps) {
  const [handle, setHandle] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!handle || !appPassword) {
      toast.error("Handle i App Password są wymagane");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Musisz być zalogowany");
        return;
      }

      // Test the credentials
      const testResponse = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: handle, password: appPassword }),
      });

      const testData = await testResponse.json();
      
      if (testData.error) {
        toast.error("Nieprawidłowe dane logowania", { 
          description: testData.message || "Sprawdź handle i App Password" 
        });
        return;
      }

      const did = testData.did;
      const displayHandle = testData.handle || handle;

      // Save to database
      const { error } = await (supabase as any).from("bluesky_tokens").insert({
        user_id: session.user.id,
        handle: displayHandle,
        did,
        app_password: appPassword,
        account_name: displayHandle,
        is_default: false,
      });

      if (error) throw error;

      toast.success("Bluesky połączony!", { description: `@${displayHandle}` });
      setHandle("");
      setAppPassword("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Nie udało się zapisać konfiguracji", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Połącz Bluesky</DialogTitle>
          <DialogDescription>
            Podaj swój handle i App Password z ustawień Bluesky
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bsky-handle">Handle</Label>
            <Input
              id="bsky-handle"
              placeholder="nazwa.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bsky-password">App Password</Label>
            <Input
              id="bsky-password"
              type="password"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Wygeneruj App Password w Bluesky → Settings → App Passwords
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !handle || !appPassword}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Połącz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
