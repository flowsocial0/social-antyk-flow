import { useConversation } from "@elevenlabs/react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function VoiceAssistant() {
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Połączono z asystentem");
      toast.success("Połączono! Możesz teraz rozmawiać.");
    },
    onDisconnect: () => {
      console.log("Rozłączono z asystentem");
    },
    onError: (error) => {
      console.error("Błąd rozmowy:", error);
      toast.error("Wystąpił błąd połączenia. Spróbuj ponownie.");
    },
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Poproś o dostęp do mikrofonu
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pobierz token z Edge Function
      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token"
      );

      if (error || !data?.token) {
        throw new Error(error?.message || "Nie otrzymano tokena");
      }

      // Rozpocznij rozmowę przez WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (error) {
      console.error("Nie udało się rozpocząć rozmowy:", error);
      toast.error("Nie udało się połączyć. Sprawdź uprawnienia mikrofonu.");
    } finally {
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-gradient-to-b from-primary/5 to-transparent rounded-2xl">
      {/* Avatar z animacją */}
      <div className="relative">
        {/* Pulsująca ramka gdy mówi */}
        <div
          className={`absolute inset-0 rounded-full transition-all duration-300 ${
            isSpeaking
              ? "bg-primary/30 animate-pulse scale-110"
              : isConnected
              ? "bg-green-500/20 scale-105"
              : "bg-muted/50"
          }`}
        />
        
        {/* Placeholder Avatar */}
        <div className="relative w-200 h-200 rounded-full overflow-hidden border-4 border-background shadow-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <span className="inline-flex items-center text-4xl font-bold text-primary-foreground">
            <img src="/Klemcia.jpg" alt="Klemcia" className="h-200 w-auto" />
          </span>
          
          {/* Ikona głośnika gdy mówi */}
          <div 
            className={`absolute bottom-2 right-2 bg-primary text-primary-foreground p-1 rounded-full transition-opacity duration-200 ${
              isSpeaking ? "opacity-100 animate-bounce" : "opacity-0"
            }`}
          >
            <Volume2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {isConnecting
            ? "Łączenie..."
            : isConnected
            ? isSpeaking
              ? "🎙️ Odpowiadam..."
              : "👂 Słucham..."
            : "Kliknij, żeby porozmawiać"}
        </p>
      </div>

      {/* Przyciski - zawsze renderowane, widoczność przez CSS */}
      <div className="relative">
        <Button
          onClick={startConversation}
          disabled={isConnecting || isConnected}
          size="lg"
          className={`gap-2 rounded-full px-8 transition-opacity duration-200 ${
            isConnected ? "opacity-0 pointer-events-none absolute inset-0" : "opacity-100"
          }`}
        >
          <Mic className="w-5 h-5" />
          {isConnecting ? "Łączenie..." : "Pogadaj z Klemcią"}
        </Button>
        <Button
          onClick={stopConversation}
          variant="destructive"
          size="lg"
          className={`gap-2 rounded-full px-8 transition-opacity duration-200 ${
            !isConnected ? "opacity-0 pointer-events-none absolute inset-0" : "opacity-100"
          }`}
        >
          <MicOff className="w-5 h-5" />
          Zakończ rozmowę
        </Button>
      </div>

      <p className="text-xs text-muted-foreground max-w-xs text-center">
        Możesz zapytać o funkcje aplikacji, jak zacząć promować książki, 
        lub jak działa planowanie kampanii.
      </p>
    </div>
  );
}
