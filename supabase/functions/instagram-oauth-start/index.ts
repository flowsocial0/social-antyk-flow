import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, redirectUri } = await req.json();

    if (!userId) {
      throw new Error('Missing userId parameter');
    }

    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const callbackUrl = Deno.env.get('INSTAGRAM_REDIRECT_URI') || 
      `https://dmrfbokchkxjzslfzeps.supabase.co/functions/v1/instagram-oauth-callback`;

    if (!appId) {
      throw new Error('Missing FACEBOOK_APP_ID environment variable');
    }

    // Generate random state for CSRF protection
    const state = `${userId}_${crypto.randomUUID()}`;

    // Instagram uses Facebook OAuth with extended permissions
    // Scopes needed for Instagram Business Account access
    const scopes = [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish'
    ].join(',');

    // Build Facebook OAuth URL with Instagram permissions
    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    console.log('Generated Instagram OAuth URL for user:', userId);

    return new Response(
      JSON.stringify({
        authUrl: authUrl.toString(),
        state,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in instagram-oauth-start:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
