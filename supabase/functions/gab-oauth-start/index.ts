import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GAB_SERVER = 'https://gab.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error('Brak userId');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const origin = req.headers.get('origin') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';
    const redirectUri = `${origin}/oauth/gab/callback`;

    // Register app on Gab (Mastodon-compatible API)
    console.log('Registering app on Gab...');
    const appResponse = await fetch(`${GAB_SERVER}/api/v1/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'BookPromo Social Publisher',
        redirect_uris: redirectUri,
        scopes: 'read write:media write:statuses',
        website: origin,
      }),
    });

    if (!appResponse.ok) {
      const errText = await appResponse.text();
      console.error('Failed to register app on Gab:', errText);
      throw new Error('Nie udało się zarejestrować aplikacji na Gab. Spróbuj ponownie.');
    }

    const appData = await appResponse.json();
    const { client_id, client_secret } = appData;

    const state = crypto.randomUUID();

    // Store credentials temporarily
    await supabase.from('gab_tokens').upsert({
      user_id: userId,
      access_token: `pending_${state}`,
      client_id,
      client_secret,
    });

    const authUrl = `${GAB_SERVER}/oauth/authorize?` + new URLSearchParams({
      client_id,
      scope: 'read write:media write:statuses',
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    }).toString();

    return new Response(JSON.stringify({
      url: authUrl,
      state,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('gab-oauth-start error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
