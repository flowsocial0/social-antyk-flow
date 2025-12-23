import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { redirectUri, userId } = await req.json();
    
    const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY');
    if (!clientKey) {
      throw new Error('TIKTOK_CLIENT_KEY not configured');
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    
    // Generate code verifier for PKCE
    const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
    
    // Generate code challenge (S256)
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const codeChallenge = btoa(String.fromCharCode(...hashArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // TikTok OAuth scopes - video.publish for direct posting, video.upload for drafts
    const scopes = [
      'user.info.basic',
      'video.publish',
      'video.upload'
    ].join(',');

    // Build TikTok authorization URL
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.set('client_key', clientKey);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    // Force consent screen to always show (required for demo video)
    authUrl.searchParams.set('prompt', 'consent');

    console.log('TikTok OAuth started for user:', userId);
    console.log('Redirect URI:', redirectUri);
    console.log('Auth URL:', authUrl.toString());

    return new Response(
      JSON.stringify({
        url: authUrl.toString(),
        state,
        codeVerifier,
        userId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('TikTok OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
