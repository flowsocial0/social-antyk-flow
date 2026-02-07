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
    const { code, userId, redirectUri } = await req.json();

    if (!code || !userId) throw new Error('Brak wymaganych parametrów');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get pending token with client credentials
    const { data: pendingToken } = await supabase
      .from('gab_tokens')
      .select('*')
      .eq('user_id', userId)
      .like('access_token', 'pending_%')
      .maybeSingle();

    if (!pendingToken) {
      throw new Error('Nie znaleziono danych rejestracji. Spróbuj ponownie.');
    }

    const { client_id, client_secret } = pendingToken;

    // Exchange code for token
    const tokenResponse = await fetch(`${GAB_SERVER}/oauth/token`, {
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
      console.error('Gab token exchange failed:', errText);
      throw new Error('Nie udało się wymienić kodu na token.');
    }

    const tokenData = await tokenResponse.json();

    // Verify credentials
    const verifyResponse = await fetch(`${GAB_SERVER}/api/v1/accounts/verify_credentials`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });

    let username = null;
    if (verifyResponse.ok) {
      const userData = await verifyResponse.json();
      username = userData.username || userData.acct;
    }

    // Update token
    await supabase.from('gab_tokens').update({
      access_token: tokenData.access_token,
      username,
      scope: tokenData.scope || 'read write:media write:statuses',
      updated_at: new Date().toISOString(),
    }).eq('id', pendingToken.id);

    return new Response(JSON.stringify({
      success: true,
      username,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('gab-oauth-callback error:', error);
    return new Response(JSON.stringify({ error: msg, success: false }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
