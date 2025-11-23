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
  tokenSecret: string
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

async function getAccessToken(
  oauthToken: string,
  oauthTokenSecret: string,
  oauthVerifier: string
): Promise<{ oauth_token: string; oauth_token_secret: string; screen_name: string; user_id: string }> {
  const url = 'https://api.twitter.com/oauth/access_token';
  const method = 'POST';

  const oauthParams = {
    oauth_consumer_key: CONSUMER_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: oauthToken,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams, CONSUMER_SECRET!, oauthTokenSecret);
  const signedParams = { ...oauthParams, oauth_signature: signature };

  const authHeader = 'OAuth ' + Object.entries(signedParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');

  console.log('Access token request with verifier:', oauthVerifier);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `oauth_verifier=${encodeURIComponent(oauthVerifier)}`,
  });

  const responseText = await response.text();
  console.log('Access token response:', responseText);

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status} - ${responseText}`);
  }

  const params = new URLSearchParams(responseText);
  return {
    oauth_token: params.get('oauth_token')!,
    oauth_token_secret: params.get('oauth_token_secret')!,
    screen_name: params.get('screen_name')!,
    user_id: params.get('user_id')!,
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

    const { oauthToken, oauthVerifier, state } = await req.json();
    console.log('OAuth callback for user:', user.id, 'token:', oauthToken, 'state:', state);

    // Retrieve request token from database
    const { data: requestData, error: requestError } = await supabase
      .from('twitter_oauth1_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('state', state)
      .eq('oauth_token', oauthToken)
      .single();

    if (requestError || !requestData) {
      console.error('Failed to retrieve request token:', requestError);
      throw new Error('Invalid OAuth state');
    }

    // Check if token expired
    if (new Date(requestData.expires_at) < new Date()) {
      throw new Error('OAuth request expired');
    }

    // Exchange for access token
    const { oauth_token, oauth_token_secret, screen_name, user_id } = await getAccessToken(
      oauthToken,
      requestData.oauth_token_secret,
      oauthVerifier
    );

    // Store access token in database (upsert)
    const { error: upsertError } = await supabase
      .from('twitter_oauth1_tokens')
      .upsert({
        user_id: user.id,
        oauth_token,
        oauth_token_secret,
        screen_name,
        x_user_id: user_id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Failed to store access token:', upsertError);
      throw new Error('Failed to save OAuth credentials');
    }

    // Delete request token
    await supabase
      .from('twitter_oauth1_requests')
      .delete()
      .eq('id', requestData.id);

    console.log('OAuth 1.0a flow completed successfully for @' + screen_name);

    return new Response(
      JSON.stringify({ success: true, screen_name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in twitter-oauth1-callback:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});