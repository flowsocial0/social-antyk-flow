import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(supabase: any, tokenId: string, refreshToken: string): Promise<string> {
  const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')!;
  const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET')!;
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error || response.statusText}`);
  }
  await supabase.from('tiktok_oauth_tokens').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', tokenId);
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Always derive userId from JWT for security
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brak autoryzacji.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brak autoryzacji.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accountId: string | undefined;
    try {
      const body = await req.json();
      accountId = body?.accountId;
    } catch {}

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let tokenQuery = supabase
      .from('tiktok_oauth_tokens')
      .select('*')
      .eq('user_id', user.id);

    if (accountId) tokenQuery = tokenQuery.eq('id', accountId);

    const { data: tokenData } = await tokenQuery.limit(1).maybeSingle();

    if (!tokenData) {
      return new Response(
        JSON.stringify({ success: false, error: 'TikTok nie jest połączony.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = tokenData.access_token;
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      if (!tokenData.refresh_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token wygasł. Połącz konto TikTok ponownie.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      accessToken = await refreshAccessToken(supabase, tokenData.id, tokenData.refresh_token);
    }

    const response = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();

    if (!response.ok || (data.error?.code && data.error.code !== 'ok')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data.error?.message || `TikTok creator_info error (${response.status})`,
          errorCode: data.error?.code || 'TIKTOK_API_ERROR',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        accountId: tokenData.id,
        openId: tokenData.open_id,
        data: data.data,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('tiktok-creator-info error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
