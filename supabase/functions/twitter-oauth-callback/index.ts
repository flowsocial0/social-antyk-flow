import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const CLIENT_ID = Deno.env.get("TWITTER_OAUTH2_CLIENT_ID")?.trim();
const CLIENT_SECRET = Deno.env.get("TWITTER_OAUTH2_CLIENT_SECRET")?.trim();
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twitter-oauth-callback`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
  
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  // Basic auth with client_id and client_secret
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  const responseText = await response.text();
  console.log('Token exchange response:', response.status, responseText);

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${responseText}`);
  }

  return JSON.parse(responseText);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    console.log('Received callback with code and state:', { code: code.substring(0, 10) + '...', state });

    // Get code_verifier from request body or query params
    const body = await req.json().catch(() => ({}));
    const codeVerifier = body.codeVerifier || url.searchParams.get('code_verifier');

    if (!codeVerifier) {
      throw new Error('code_verifier is required. Pass it in the request body or query params.');
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code, codeVerifier);
    
    console.log('Token data received:', {
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
    });

    // Calculate expiration time
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Store token in database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: dbError } = await supabaseClient
      .from('twitter_oauth_tokens')
      .insert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_at: expiresAt,
        scope: tokenData.scope,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to store token: ${dbError.message}`);
    }

    console.log('Token stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Twitter authorization successful! You can now publish tweets.',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in twitter-oauth-callback:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
