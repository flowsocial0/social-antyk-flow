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
    console.log('=== LinkedIn OAuth Start ===');
    
    const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID');
    const LINKEDIN_REDIRECT_URI = Deno.env.get('LINKEDIN_REDIRECT_URI');

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_REDIRECT_URI) {
      throw new Error('Missing LINKEDIN_CLIENT_ID or LINKEDIN_REDIRECT_URI environment variables');
    }

    const body = await req.json().catch(() => ({}));
    const { userId } = body as { userId?: string };
    
    console.log('Request body:', { userId: userId ? 'present' : 'missing' });

    if (!userId) {
      throw new Error('Missing userId in request body');
    }

    // Generate state with userId embedded (format: userId_randomString)
    const state = `${userId}_${crypto.randomUUID()}`;
    console.log('Generated state (userId embedded):', state);

    // LinkedIn OAuth 2.0 scopes
    // openid, profile - basic user info (OIDC)
    // w_member_social - post on behalf of user
    const scopes = [
      'openid',
      'profile',
      'w_member_social'
    ].join(' ');

    // Build LinkedIn OAuth URL (OAuth 2.0 with OIDC)
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', LINKEDIN_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', LINKEDIN_REDIRECT_URI);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    console.log('Generated LinkedIn OAuth URL:', authUrl.toString());

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
    console.error('Error generating LinkedIn OAuth URL:', error);
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
