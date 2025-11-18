import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const CLIENT_ID = Deno.env.get("TWITTER_OAUTH2_CLIENT_ID")?.trim();
const CLIENT_SECRET = Deno.env.get("TWITTER_OAUTH2_CLIENT_SECRET")?.trim();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function exchangeCodeForToken(code: string, codeVerifier: string, redirectUri: string) {
  const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
  
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: CLIENT_ID!,
    redirect_uri: redirectUri,
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
    // Get user_id from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with user token to get user_id
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Failed to get user from token');
    }

    const userId = user.id;

    // Get parameters from request body
    const body = await req.json().catch(() => ({}));
    const { code, codeVerifier, state, redirectUri } = body;

    if (!code) {
      throw new Error('No authorization code received');
    }

    if (!codeVerifier) {
      throw new Error('code_verifier is required in request body');
    }

    if (!redirectUri) {
      throw new Error('redirectUri is required in request body');
    }

    console.log('Received callback with code and state:', { code: code.substring(0, 10) + '...', state });

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code, codeVerifier, redirectUri);
    
    console.log('Token data received:', {
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
    });

    // Calculate expiration time
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Store token in database - use service role for upsert
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: dbError } = await supabaseService
      .from('twitter_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_at: expiresAt,
        scope: tokenData.scope,
      }, {
        onConflict: 'user_id'
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
