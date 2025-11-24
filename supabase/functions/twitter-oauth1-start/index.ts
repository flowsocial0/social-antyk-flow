import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONSUMER_KEY = Deno.env.get('TWITTER_CONSUMER_KEY')?.trim();
const CONSUMER_SECRET = Deno.env.get('TWITTER_CONSUMER_SECRET')?.trim();

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ''
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac('sha1', signingKey);
  return hmacSha1.update(signatureBaseString).digest('base64');
}

async function getRequestToken(callbackUrl: string): Promise<{ oauth_token: string; oauth_token_secret: string }> {
  const url = 'https://api.twitter.com/oauth/request_token';
  const method = 'POST';
  
  const oauthParams = {
    oauth_consumer_key: CONSUMER_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    oauth_callback: callbackUrl,
  };

  const signature = generateOAuthSignature(method, url, oauthParams, CONSUMER_SECRET!);
  const signedParams = { ...oauthParams, oauth_signature: signature };

  const authHeader = 'OAuth ' + Object.entries(signedParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');

  console.log('Request token OAuth header:', authHeader);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const responseText = await response.text();
  console.log('Request token response:', responseText);

  if (!response.ok) {
    throw new Error(`Failed to get request token: ${response.status} - ${responseText}`);
  }

  const params = new URLSearchParams(responseText);
  return {
    oauth_token: params.get('oauth_token')!,
    oauth_token_secret: params.get('oauth_token_secret')!,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== twitter-oauth1-start called ===");
  console.log("Method:", req.method);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));

  try {
    // Validate environment variables
    console.log("Checking environment variables...");
    console.log("CONSUMER_KEY exists:", !!CONSUMER_KEY);
    console.log("CONSUMER_SECRET exists:", !!CONSUMER_SECRET);
    
    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
      console.error("Missing Twitter OAuth credentials!");
      throw new Error('Missing Twitter OAuth credentials. Please configure TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET in Supabase Secrets.');
    }

    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    console.log("Authorization header exists:", !!authHeader);
    
    if (!authHeader) {
      console.error("Missing authorization header");
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    console.log("Getting user from token...");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      throw new Error('Unauthorized');
    }
    console.log("User authenticated successfully:", user.id);

    // Parse request body
    const body = await req.json();
    const { redirectUri } = body;
    console.log('Redirect URI from request:', redirectUri);
    
    if (!redirectUri) {
      console.error("Missing redirectUri in request body");
      throw new Error('Missing redirectUri parameter');
    }

    console.log('=== Starting OAuth 1.0a flow ===');
    console.log('User ID:', user.id);
    console.log('Redirect URI:', redirectUri);

    // Get request token from Twitter
    console.log("Calling getRequestToken...");
    const { oauth_token, oauth_token_secret } = await getRequestToken(redirectUri);
    console.log("Request token received successfully");
    console.log("OAuth token (first 10 chars):", oauth_token.substring(0, 10) + "...");

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    console.log("Generated state:", state);

    // Store request token in database
    console.log("Storing request token in database...");
    const { error: insertError } = await supabase
      .from('twitter_oauth1_requests')
      .insert({
        user_id: user.id,
        state,
        oauth_token,
        oauth_token_secret,
      });

    if (insertError) {
      console.error('Failed to store request token:', insertError);
      throw new Error('Failed to store OAuth state: ' + insertError.message);
    }
    console.log("Request token stored successfully");

    // Build authorization URL
    const authUrl = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauth_token}`;
    console.log("Authorization URL:", authUrl);

    console.log("=== OAuth 1.0a start completed successfully ===");
    return new Response(
      JSON.stringify({ authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('=== Error in twitter-oauth1-start ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Check edge function logs for more information"
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});