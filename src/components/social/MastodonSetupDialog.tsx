import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Globe } from "lucide-react";

interface MastodonSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MastodonSetupDialog({ open, onOpenChange, onSuccess }: MastodonSetupDialogProps) {
  const [serverUrl, setServerUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    if (!serverUrl.trim()) {
      toast.error("Podaj URL serwera Mastodon");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Musisz być zalogowany");
        return;
      }

      const { data, error } = await supabase.functions.invoke("mastodon-oauth-start", {
        body: { serverUrl: serverUrl.trim(), userId: session.user.id },
      });

      if (error) throw error;

      if (data?.url) {
        if (data.state) {
          sessionStorage.setItem("mastodon_oauth_state", data.state);
          sessionStorage.setItem("mastodon_server_url", data.serverUrl || serverUrl.trim());
          sessionStorage.setItem("mastodon_user_id", session.user.id);
        }
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast.error("Nie udało się połączyć z Mastodon", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-purple-600" />
            Połącz konto Mastodon
          </DialogTitle>
          <DialogDescription>
            Podaj URL swojego serwera Mastodon (np. mastodon.social, fosstodon.org).
            Zostaniesz przekierowany do logowania OAuth.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="mastodon-server">URL serwera Mastodon</Label>
            <Input
              id="mastodon-server"
              placeholder="mastodon.social"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button onClick={handleConnect} disabled={isLoading || !serverUrl.trim()} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Połącz przez OAuth
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
