import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONSUMER_KEY = Deno.env.get('TUMBLR_API_KEY')?.trim();
const CONSUMER_SECRET = Deno.env.get('TUMBLR_API_SECRET')?.trim();

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
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
}

async function getRequestToken(callbackUrl: string): Promise<{ oauth_token: string; oauth_token_secret: string }> {
  const url = 'https://www.tumblr.com/oauth/request_token';
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    oauth_callback: callbackUrl,
  };

  const signature = generateOAuthSignature('POST', url, oauthParams, CONSUMER_SECRET!);
  const signedParams = { ...oauthParams, oauth_signature: signature };

  const authHeader = 'OAuth ' + Object.entries(signedParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const responseText = await response.text();
  console.log('Tumblr request token response:', responseText);

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
      throw new Error('Missing Tumblr OAuth credentials (TUMBLR_API_KEY / TUMBLR_API_SECRET)');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { redirectUri } = body;
    if (!redirectUri) throw new Error('Missing redirectUri parameter');

    console.log('=== Tumblr OAuth1 start ===');
    console.log('User:', user.id, 'Redirect:', redirectUri);

    const { oauth_token, oauth_token_secret } = await getRequestToken(redirectUri);

    const state = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

    // Cleanup expired
    await supabase.from('tumblr_oauth1_requests').delete().eq('user_id', user.id).lt('expires_at', new Date().toISOString());

    // Store request token
    const { error: insertError } = await supabase.from('tumblr_oauth1_requests').insert({
      user_id: user.id,
      state,
      oauth_token,
      oauth_token_secret,
    });
    if (insertError) throw new Error('Failed to store OAuth state: ' + insertError.message);

    const authUrl = `https://www.tumblr.com/oauth/authorize?oauth_token=${oauth_token}`;

    return new Response(
      JSON.stringify({ authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Tumblr OAuth1 start error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
