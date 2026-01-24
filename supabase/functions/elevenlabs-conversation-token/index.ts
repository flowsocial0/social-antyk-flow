import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");

  if (!ELEVENLABS_API_KEY) {
    console.error("Missing ELEVENLABS_API_KEY secret");
    return new Response(
      JSON.stringify({ error: "Brak klucza API ElevenLabs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!ELEVENLABS_AGENT_ID) {
    console.error("Missing ELEVENLABS_AGENT_ID secret");
    return new Response(
      JSON.stringify({ error: "Brak ID agenta ElevenLabs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    console.log("Requesting conversation token for agent:", ELEVENLABS_AGENT_ID);
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Successfully obtained conversation token");

    return new Response(
      JSON.stringify({ token: data.token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error getting conversation token:", error);
    return new Response(
      JSON.stringify({ error: "Nie udało się uzyskać tokena rozmowy" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
