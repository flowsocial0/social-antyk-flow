import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      throw new Error('Missing userId parameter');
    }

    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const frontendUrl = (Deno.env.get('FRONTEND_URL') || 'https://socialautoflow.pl').replace(/\/$/, '');
    const redirectUri = `https://dmrfbokchkxjzslfzeps.supabase.co/functions/v1/threads-oauth-callback`;

    if (!appId) {
      throw new Error('Missing FACEBOOK_APP_ID environment variable');
    }

    // Generate random state for CSRF protection
    const state = `${userId}_${crypto.randomUUID()}`;

    // Threads API scopes
    const scopes = [
      'threads_basic',
      'threads_content_publish',
      'threads_manage_replies',
    ].join(',');

    // Build Threads OAuth URL
    const authUrl = new URL('https://threads.net/oauth/authorize');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    console.log('Generated Threads OAuth URL for user:', userId);

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
    console.error('Error in threads-oauth-start:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
