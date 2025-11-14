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
    const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID');
    const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET');
    const FACEBOOK_REDIRECT_URI = Deno.env.get('FACEBOOK_REDIRECT_URI');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET || !FACEBOOK_REDIRECT_URI) {
      throw new Error('Missing Facebook OAuth environment variables');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { code, state } = await req.json();

    if (!code) {
      throw new Error('Missing authorization code');
    }

    console.log('Exchanging Facebook code for token...');

    // Step 1: Exchange code for short-lived access token
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    tokenUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', FACEBOOK_REDIRECT_URI);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error('Facebook token exchange error:', tokenData);
      throw new Error(tokenData.error?.message || 'Failed to exchange code for token');
    }

    const shortLivedToken = tokenData.access_token;
    console.log('Obtained short-lived token');

    // Step 2: Exchange for long-lived token
    const longLivedUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    longLivedUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET);
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    if (!longLivedResponse.ok || longLivedData.error) {
      console.error('Facebook long-lived token error:', longLivedData);
      throw new Error(longLivedData.error?.message || 'Failed to get long-lived token');
    }

    const longLivedToken = longLivedData.access_token;
    console.log('Obtained long-lived user token');

    // Step 3: Get user's pages
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok || pagesData.error) {
      console.error('Facebook pages error:', pagesData);
      throw new Error(pagesData.error?.message || 'Failed to get user pages');
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook Pages found. You need to be an admin of at least one Facebook Page to publish posts.');
    }

    // Use the first page (in production, let user choose)
    const page = pagesData.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;
    const pageName = page.name;

    console.log('Using Facebook Page:', pageName, pageId);

    // Calculate expiration (long-lived tokens last ~60 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // Delete existing tokens (only one active token at a time)
    await supabase.from('facebook_oauth_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Store Page Access Token
    const { data: tokenRecord, error: insertError } = await supabase
      .from('facebook_oauth_tokens')
      .insert({
        access_token: pageAccessToken,
        token_type: 'Bearer',
        expires_at: expiresAt.toISOString(),
        page_id: pageId,
        page_name: pageName,
        scope: 'pages_manage_posts,pages_read_engagement'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing Facebook token:', insertError);
      throw new Error('Failed to store Facebook token');
    }

    console.log('Successfully stored Facebook Page token');

    return new Response(
      JSON.stringify({
        success: true,
        page_name: pageName,
        page_id: pageId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
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