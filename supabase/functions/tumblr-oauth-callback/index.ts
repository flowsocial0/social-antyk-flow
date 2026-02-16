import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from "node:crypto";

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

function buildOAuthHeader(params: Record<string, string>): string {
  return 'OAuth ' + Object.entries(params)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const oauthToken = url.searchParams.get('oauth_token');
    const oauthVerifier = url.searchParams.get('oauth_verifier');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';

    if (!oauthToken || !oauthVerifier) {
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=missing_params`, 302);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Find the request token
    const { data: requestData, error: reqError } = await supabase
      .from('tumblr_oauth1_requests')
      .select('*')
      .eq('oauth_token', oauthToken)
      .single();

    if (reqError || !requestData) {
      console.error('Request token not found:', reqError);
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=invalid_state`, 302);
    }

    const userId = requestData.user_id;
    const requestTokenSecret = requestData.oauth_token_secret;

    // Exchange for access token
    const accessTokenUrl = 'https://www.tumblr.com/oauth/access_token';
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: CONSUMER_KEY!,
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
      oauth_version: '1.0',
    };

    const signature = generateOAuthSignature('POST', accessTokenUrl, oauthParams, CONSUMER_SECRET!, requestTokenSecret);
    const signedParams = { ...oauthParams, oauth_signature: signature };

    const response = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: buildOAuthHeader(signedParams),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const responseText = await response.text();
    console.log('Tumblr access token response:', responseText);

    if (!response.ok) {
      console.error('Access token exchange failed:', responseText);
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=token_exchange_failed`, 302);
    }

    const params = new URLSearchParams(responseText);
    const accessToken = params.get('oauth_token')!;
    const accessTokenSecret = params.get('oauth_token_secret')!;

    // Get user info using OAuth1
    const userInfoUrl = 'https://api.tumblr.com/v2/user/info';
    const userOauthParams: Record<string, string> = {
      oauth_consumer_key: CONSUMER_KEY!,
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0',
    };
    const userSig = generateOAuthSignature('GET', userInfoUrl, userOauthParams, CONSUMER_SECRET!, accessTokenSecret);
    const userSignedParams = { ...userOauthParams, oauth_signature: userSig };

    const userResponse = await fetch(userInfoUrl, {
      headers: { Authorization: buildOAuthHeader(userSignedParams) },
    });

    let blogName = null;
    let username = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      username = userData.response?.user?.name;
      blogName = userData.response?.user?.blogs?.[0]?.name;
    }

    // Store OAuth1 tokens
    await supabase.from('tumblr_oauth_tokens').insert({
      user_id: userId,
      access_token: accessToken,
      oauth_token_secret: accessTokenSecret,
      refresh_token: null,
      expires_at: null, // OAuth1 tokens don't expire
      scope: null,
      blog_name: blogName || null,
      username: username || null,
      account_name: username || blogName || null,
    });

    // Cleanup request token
    await supabase.from('tumblr_oauth1_requests').delete().eq('id', requestData.id);

    return Response.redirect(`${siteUrl}/settings/social-accounts?connected=true&platform=tumblr`, 302);
  } catch (error: any) {
    console.error('Tumblr OAuth1 callback error:', error);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';
    return Response.redirect(`${siteUrl}/settings/social-accounts?error=callback_failed`, 302);
  }
});
