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
    console.log('=== Facebook OAuth Callback ===');
    
    // Get code and state from query parameters (Facebook sends them via GET)
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    console.log('Received params:', { 
      code: code ? 'present' : 'missing', 
      state: state || 'missing' 
    });
    
    if (!state) {
      throw new Error('Missing state parameter');
    }
    
    // Extract userId from state (format: userId_randomString)
    const userId = state.split('_')[0];
    console.log('Extracted userId from state:', userId);
    
    if (!userId) {
      throw new Error('Invalid state - missing user_id');
    }

    if (!code) {
      throw new Error('Missing authorization code');
    }

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

    // Store Page Access Token (upsert based on user_id)
    console.log('Storing token for userId:', userId, 'pageId:', pageId, 'pageName:', pageName);
    
    const { data: tokenRecord, error: insertError } = await supabase
      .from('facebook_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: pageAccessToken,
        token_type: 'Bearer',
        expires_at: expiresAt.toISOString(),
        page_id: pageId,
        page_name: pageName,
        scope: 'pages_manage_posts,pages_read_engagement'
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing Facebook token:', insertError);
      throw new Error('Failed to store Facebook token: ' + insertError.message);
    }

    console.log('Successfully stored Facebook Page token:', tokenRecord);

    // Redirect user back to the application
    const redirectUrl = new URL('https://c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovableproject.com/platforms/facebook');
    redirectUrl.searchParams.set('connected', 'true');
    redirectUrl.searchParams.set('page_name', pageName);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl.toString(),
      },
    });
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Redirect back to app with error
    const redirectUrl = new URL('https://c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovableproject.com/platforms/facebook');
    redirectUrl.searchParams.set('error', errorMessage);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl.toString(),
      },
    });
  }
});