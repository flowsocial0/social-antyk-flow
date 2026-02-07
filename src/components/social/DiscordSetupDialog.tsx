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

interface DiscordSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DiscordSetupDialog({ open, onOpenChange, onSuccess }: DiscordSetupDialogProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelName, setChannelName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!webhookUrl) {
      toast.error("Webhook URL jest wymagany");
      return;
    }

    if (!webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.startsWith("https://discordapp.com/api/webhooks/")) {
      toast.error("Nieprawidłowy Webhook URL", { description: "URL musi zaczynać się od https://discord.com/api/webhooks/" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Musisz być zalogowany");
        return;
      }

      // Test the webhook
      const testResponse = await fetch(webhookUrl);
      if (!testResponse.ok) {
        toast.error("Nieprawidłowy Webhook URL", { description: "Nie udało się połączyć z webhookiem" });
        return;
      }

      const webhookInfo = await testResponse.json();
      const name = webhookInfo.name || "Discord Webhook";

      // Save to database
      const { error } = await (supabase as any).from("discord_tokens").insert({
        user_id: session.user.id,
        webhook_url: webhookUrl,
        channel_name: channelName || webhookInfo.channel_id || name,
        account_name: channelName || name,
        is_default: false,
      });

      if (error) throw error;

      toast.success("Discord skonfigurowany!", { description: `Webhook: ${name}` });
      setWebhookUrl("");
      setChannelName("");
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
          <DialogTitle>Konfiguracja Discord</DialogTitle>
          <DialogDescription>
            Podaj Webhook URL kanału Discord, na który chcesz publikować
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://discord.com/api/webhooks/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              W Discord: Ustawienia kanału → Integracje → Webhooki → Nowy webhook → Kopiuj URL
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="discord-channel-name">Nazwa kanału (opcjonalnie)</Label>
            <Input
              id="discord-channel-name"
              placeholder="np. #promocje-książek"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !webhookUrl}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
