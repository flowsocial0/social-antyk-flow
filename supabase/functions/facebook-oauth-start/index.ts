import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Facebook OAuth Start ===');
    
    const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID');
    const FACEBOOK_REDIRECT_URI = Deno.env.get('FACEBOOK_REDIRECT_URI');

    if (!FACEBOOK_APP_ID || !FACEBOOK_REDIRECT_URI) {
      throw new Error('Missing FACEBOOK_APP_ID or FACEBOOK_REDIRECT_URI environment variables');
    }

    // Read userId from request body (redirect URI is fixed to the edge function callback)
    const body = await req.json().catch(() => ({}));
    const { userId } = body as { userId?: string };
    
    console.log('Request body:', { userId: userId ? 'present' : 'missing' });

    if (!userId) {
      throw new Error('Missing userId in request body');
    }

    // Always use the configured Facebook redirect URI (edge function callback)
    const finalRedirectUri = FACEBOOK_REDIRECT_URI;
    console.log('Using redirect URI:', finalRedirectUri);

    // Generate state with userId embedded (format: userId_randomString)
    const state = `${userId}_${crypto.randomUUID()}`;
    console.log('Generated state (userId embedded):', state);

    // Basic scopes that don't require app review
    // Note: For posting to pages, you'll need 'pages_manage_posts' which requires Facebook app review
    const scopes = ['public_profile', 'pages_show_list', 'pages_manage_posts', 'pages_read_engagement'].join(',');

    // Build Facebook OAuth URL
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    authUrl.searchParams.set('redirect_uri', finalRedirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    console.log('Generated Facebook OAuth URL:', authUrl.toString());

    return new Response(
      JSON.stringify({ 
        url: authUrl.toString(),
        state 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating Facebook OAuth URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});