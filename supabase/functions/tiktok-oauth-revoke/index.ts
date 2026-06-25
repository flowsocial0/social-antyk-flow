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
    console.log('=== TikTok OAuth Revoke Request ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')!;
    const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET')!;

    // Optional body { accountId } — when omitted, revokes ALL TikTok accounts for user
    let accountId: string | undefined = undefined;
    try {
      const body = await req.json();
      if (body && typeof body.accountId === 'string') accountId = body.accountId;
    } catch (_) { /* empty body is fine */ }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Brak autoryzacji');

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Użytkownik nie zalogowany');

    console.log('User ID:', user.id, 'accountId:', accountId ?? '(all)');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let q = supabase
      .from('tiktok_oauth_tokens')
      .select('*')
      .eq('user_id', user.id);
    if (accountId) q = q.eq('id', accountId);

    const { data: tokens, error: tokenError } = await q;

    if (tokenError) {
      console.error('Token fetch error:', tokenError);
      throw new Error('Błąd pobierania tokena');
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Brak tokenów do odwołania' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ id: string; revoked: boolean; note?: string }> = [];

    for (const tokenData of tokens) {
      try {
        console.log('Revoking TikTok token id:', tokenData.id);
        const revokeResponse = await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            token: tokenData.access_token,
          }).toString(),
        });
        const revokeData = await revokeResponse.json().catch(() => ({}));
        console.log('TikTok revoke response:', JSON.stringify(revokeData));

        results.push({
          id: tokenData.id,
          revoked: !revokeData.error,
          note: revokeData.error ? 'Token mógł już wygasnąć po stronie TikTok' : undefined,
        });
      } catch (err: any) {
        console.warn('Revoke call failed for token', tokenData.id, err?.message);
        results.push({ id: tokenData.id, revoked: false, note: err?.message });
      }
    }

    // Delete from DB (always, even when remote revoke failed)
    let delQ = supabase.from('tiktok_oauth_tokens').delete().eq('user_id', user.id);
    if (accountId) delQ = delQ.eq('id', accountId);
    const { error: deleteError } = await delQ;

    if (deleteError) {
      console.error('Delete token error:', deleteError);
      throw new Error('Błąd usuwania tokena z bazy');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: accountId
          ? 'Wybrane konto TikTok zostało odwołane i usunięte'
          : 'Wszystkie konta TikTok zostały odwołane i usunięte',
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('TikTok OAuth revoke error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
