import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { serverUrl, userId } = await req.json();

    if (!serverUrl) throw new Error('Musisz podać URL serwera Mastodon');
    if (!userId) throw new Error('Brak userId');

    // Normalize server URL
    let normalizedUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Determine the redirect URI based on request origin
    const origin = req.headers.get('origin') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';
    const redirectUri = `${origin}/oauth/mastodon/callback`;

    // Step 1: Register application on the Mastodon server (dynamic registration)
    console.log('Registering app on Mastodon server:', normalizedUrl);
    const appResponse = await fetch(`${normalizedUrl}/api/v1/apps`, {
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
      console.error('Failed to register app:', errText);
      throw new Error(`Nie udało się zarejestrować aplikacji na serwerze ${normalizedUrl}. Sprawdź czy URL jest poprawny.`);
    }

    const appData = await appResponse.json();
    const { client_id, client_secret } = appData;

    // Generate a state parameter
    const state = crypto.randomUUID();

    // Store the registration data temporarily for the callback
    // We store in mastodon_tokens temporarily with a placeholder
    await supabase.from('mastodon_tokens').upsert({
      user_id: userId,
      server_url: normalizedUrl,
      client_id,
      client_secret,
      access_token: `pending_${state}`, // placeholder until callback
      scope: 'read write:media write:statuses',
    }, { onConflict: 'user_id,server_url' });

    // Step 2: Build OAuth authorization URL
    const authUrl = `${normalizedUrl}/oauth/authorize?` + new URLSearchParams({
      client_id,
      scope: 'read write:media write:statuses',
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    }).toString();

    console.log('Auth URL built, redirecting user');

    return new Response(JSON.stringify({
      url: authUrl,
      state,
      serverUrl: normalizedUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('mastodon-oauth-start error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
