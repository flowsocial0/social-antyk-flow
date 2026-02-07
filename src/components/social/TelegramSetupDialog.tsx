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

interface TelegramSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TelegramSetupDialog({ open, onOpenChange, onSuccess }: TelegramSetupDialogProps) {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [channelName, setChannelName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!botToken || !chatId) {
      toast.error("Bot Token i Chat ID są wymagane");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Musisz być zalogowany");
        return;
      }

      // Test the bot token first
      const testResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const testData = await testResponse.json();
      
      if (!testData.ok) {
        toast.error("Nieprawidłowy Bot Token", { description: "Sprawdź token otrzymany od @BotFather" });
        return;
      }

      const botName = testData.result?.username || "Bot";

      // Save to database
      const { error } = await (supabase as any).from("telegram_tokens").insert({
        user_id: session.user.id,
        bot_token: botToken,
        chat_id: chatId,
        channel_name: channelName || `@${botName} → ${chatId}`,
        account_name: channelName || `@${botName}`,
        is_default: false,
      });

      if (error) throw error;

      toast.success("Telegram skonfigurowany!", { description: `Bot: @${botName}` });
      setBotToken("");
      setChatId("");
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
          <DialogTitle>Konfiguracja Telegram</DialogTitle>
          <DialogDescription>
            Podaj Bot Token (od @BotFather) i Chat ID kanału/grupy
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bot-token">Bot Token</Label>
            <Input
              id="bot-token"
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Utwórz bota przez @BotFather na Telegramie i skopiuj token
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chat-id">Chat ID</Label>
            <Input
              id="chat-id"
              placeholder="-1001234567890 lub @nazwakanalu"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Dla kanału: @nazwakanalu. Dla grupy: użyj bota @userinfobot aby poznać Chat ID
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-name">Nazwa (opcjonalnie)</Label>
            <Input
              id="channel-name"
              placeholder="Mój kanał"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !botToken || !chatId}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
