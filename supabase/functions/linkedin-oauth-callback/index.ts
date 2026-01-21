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
    console.log('=== LinkedIn OAuth Callback ===');
    
    // Get code and state from query parameters (LinkedIn sends them via GET)
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
    console.log('Received params:', { 
      code: code ? 'present' : 'missing', 
      state: state || 'missing',
      error: errorParam || 'none'
    });

    const FRONTEND_URL_RAW = Deno.env.get('FRONTEND_URL') || 'https://socialautoflow.pl';
    const FRONTEND_URL = FRONTEND_URL_RAW.replace(/\/$/, '');

    // Check if user cancelled or LinkedIn returned an error
    if (errorParam) {
      console.log('User cancelled or error from LinkedIn:', errorParam, errorDescription);
      const redirectUrl = new URL(`${FRONTEND_URL}/platforms/linkedin`);
      redirectUrl.searchParams.set('cancelled', 'true');
      redirectUrl.searchParams.set('error', errorDescription || errorParam);
      
      return new Response(null, {
        status: 302,
        headers: { 'Location': redirectUrl.toString() },
      });
    }
    
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

    const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID');
    const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET');
    const LINKEDIN_REDIRECT_URI = Deno.env.get('LINKEDIN_REDIRECT_URI');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REDIRECT_URI) {
      throw new Error('Missing LinkedIn OAuth environment variables');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Exchanging LinkedIn code for token...');

    // Step 1: Exchange code for access token
    const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error('LinkedIn token exchange error:', tokenData);
      throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange code for token');
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in; // in seconds
    const refreshToken = tokenData.refresh_token || null;
    const scope = tokenData.scope || '';
    
    console.log('Obtained LinkedIn access token, expires_in:', expiresIn);

    // Step 2: Get user profile info using OIDC userinfo endpoint
    const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      console.error('LinkedIn userinfo error:', userInfo);
      throw new Error('Failed to get LinkedIn user info');
    }

    console.log('LinkedIn user info:', {
      sub: userInfo.sub,
      name: userInfo.name,
      picture: userInfo.picture ? 'present' : 'missing'
    });

    const linkedinId = userInfo.sub; // LinkedIn member URN/ID
    const displayName = userInfo.name || 'LinkedIn User';
    const profilePictureUrl = userInfo.picture || null;

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (expiresIn || 3600));

    // Step 3: Store token in database (multi-account support)
    // Check if this LinkedIn account already exists for this user
    const { data: existingAccount } = await supabase
      .from('linkedin_oauth_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('linkedin_id', linkedinId)
      .maybeSingle();

    if (existingAccount) {
      // Update existing account
      console.log('Updating existing LinkedIn account:', existingAccount.id);
      const { error: updateError } = await supabase
        .from('linkedin_oauth_tokens')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_at: expiresAt.toISOString(),
          display_name: displayName,
          profile_picture_url: profilePictureUrl,
          scope: scope,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id);

      if (updateError) {
        console.error('Error updating LinkedIn token:', updateError);
        throw new Error('Failed to update LinkedIn token: ' + updateError.message);
      }
    } else {
      // Insert new account - check if user has any existing accounts to set is_default
      const { count } = await supabase
        .from('linkedin_oauth_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const isDefault = (count || 0) === 0;
      console.log('Inserting new LinkedIn account, is_default:', isDefault);

      const { error: insertError } = await supabase
        .from('linkedin_oauth_tokens')
        .insert({
          user_id: userId,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_at: expiresAt.toISOString(),
          linkedin_id: linkedinId,
          display_name: displayName,
          account_name: displayName,
          profile_picture_url: profilePictureUrl,
          scope: scope,
          is_default: isDefault,
        });

      if (insertError) {
        console.error('Error inserting LinkedIn token:', insertError);
        throw new Error('Failed to store LinkedIn token: ' + insertError.message);
      }
    }

    console.log('Successfully stored LinkedIn token for user:', userId);

    // Redirect user back to the application
    const redirectUrl = new URL(`${FRONTEND_URL}/settings/social-accounts`);
    redirectUrl.searchParams.set('connected', 'true');
    redirectUrl.searchParams.set('platform', 'linkedin');
    redirectUrl.searchParams.set('name', displayName);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl.toString(),
      },
    });

  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const FRONTEND_URL_FALLBACK = (Deno.env.get('FRONTEND_URL') || 'https://socialautoflow.pl').replace(/\/$/, '');
    
    // Redirect back to app with error
    const redirectUrl = new URL(`${FRONTEND_URL_FALLBACK}/platforms/linkedin`);
    redirectUrl.searchParams.set('error', errorMessage);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl.toString(),
      },
    });
  }
});
