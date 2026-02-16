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
    const body = await req.json();
    const { code, state, serverUrl, userId, redirectUri, lookupServerUrl } = body;

    // Handle server URL lookup (fallback when sessionStorage is lost)
    if (lookupServerUrl && userId) {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: pendingToken } = await supabase
        .from('mastodon_tokens')
        .select('server_url')
        .eq('user_id', userId)
        .like('access_token', 'pending_%')
        .limit(1)
        .maybeSingle();
      
      return new Response(JSON.stringify({
        serverUrl: pendingToken?.server_url || null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!code || !serverUrl || !userId) {
      throw new Error('Brak wymaganych parametrów (code, serverUrl, userId)');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Retrieve the client credentials stored during oauth-start
    const { data: pendingToken } = await supabase
      .from('mastodon_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('server_url', serverUrl)
      .like('access_token', 'pending_%')
      .maybeSingle();

    if (!pendingToken) {
      throw new Error('Nie znaleziono danych rejestracji aplikacji. Spróbuj ponownie.');
    }

    const { client_id, client_secret } = pendingToken;

    // Exchange code for access token
    console.log('Exchanging code for token on:', serverUrl);
    const tokenResponse = await fetch(`${serverUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id,
        client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code,
        scope: 'read write:media write:statuses',
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Token exchange failed:', errText);
      throw new Error('Nie udało się wymienić kodu na token. Spróbuj ponownie.');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Verify credentials and get username
    const verifyResponse = await fetch(`${serverUrl}/api/v1/accounts/verify_credentials`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    let username = null;
    if (verifyResponse.ok) {
      const userData = await verifyResponse.json();
      username = userData.username || userData.acct;
      console.log('Verified Mastodon user:', username);
    }

    // Update the token record with real access token
    await supabase.from('mastodon_tokens').update({
      access_token: accessToken,
      username,
      scope: tokenData.scope || 'read write:media write:statuses',
      updated_at: new Date().toISOString(),
    }).eq('id', pendingToken.id);

    return new Response(JSON.stringify({
      success: true,
      username,
      serverUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('mastodon-oauth-callback error:', error);
    return new Response(JSON.stringify({ error: msg, success: false }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
