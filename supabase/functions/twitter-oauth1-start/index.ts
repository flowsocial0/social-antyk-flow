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

  try {
    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
      throw new Error('Missing Twitter OAuth credentials');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { redirectUri } = await req.json();
    console.log('Starting OAuth 1.0a flow for user:', user.id, 'redirect:', redirectUri);

    // Get request token from Twitter
    const { oauth_token, oauth_token_secret } = await getRequestToken(redirectUri);

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

    // Store request token in database
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
      throw new Error('Failed to store OAuth state');
    }

    // Build authorization URL
    const authUrl = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauth_token}`;

    return new Response(
      JSON.stringify({ authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in twitter-oauth1-start:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});