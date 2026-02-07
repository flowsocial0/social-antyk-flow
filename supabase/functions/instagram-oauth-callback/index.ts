import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Remove trailing slash to avoid double slashes in URLs
const FRONTEND_URL = (Deno.env.get('FRONTEND_URL') || 'https://socialautoflow.pl').replace(/\/$/, '');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorReason = url.searchParams.get('error_reason');

    console.log('Instagram OAuth callback received:', { code: !!code, state, error });

    // Handle user cancellation or errors
    if (error || errorReason) {
      console.log('User cancelled or error:', error, errorReason);
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=cancelled`, 302);
    }

    if (!code || !state) {
      console.error('Missing code or state');
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=missing_params`, 302);
    }

    // Extract userId from state (format: userId_uuid)
    const userId = state.split('_')[0];
    if (!userId) {
      console.error('Invalid state format');
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=invalid_state`, 302);
    }

    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    const redirectUri = Deno.env.get('INSTAGRAM_REDIRECT_URI') ||
      `https://dmrfbokchkxjzslfzeps.supabase.co/functions/v1/instagram-oauth-callback`;

    if (!appId || !appSecret) {
      console.error('Missing Facebook app credentials');
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=server_config`, 302);
    }

    // Step 1: Exchange code for short-lived access token
    console.log('Exchanging code for access token...');
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Error getting access token:', tokenData.error);
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=token_exchange_failed`, 302);
    }

    const shortLivedToken = tokenData.access_token;
    console.log('Got short-lived token');

    // Step 2: Exchange for long-lived token
    console.log('Exchanging for long-lived token...');
    const longLivedUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', appId);
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    if (longLivedData.error) {
      console.error('Error getting long-lived token:', longLivedData.error);
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=long_token_failed`, 302);
    }

    const accessToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in || 5184000; // Default 60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    console.log('Got long-lived token, expires in:', expiresIn, 'seconds');

    // Step 3: Check granted permissions first
    console.log('Checking granted permissions...');
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${accessToken}`
    );
    const permissionsData = await permissionsResponse.json();
    console.log('Granted permissions:', JSON.stringify(permissionsData));
    
    const grantedPermissions = (permissionsData.data || [])
      .filter((p: any) => p.status === 'granted')
      .map((p: any) => p.permission);
    console.log('Granted permission names:', grantedPermissions);
    
    // Check if pages_show_list permission was granted
    const hasPagesPermission = grantedPermissions.includes('pages_show_list');
    const hasInstagramPermission = grantedPermissions.includes('instagram_basic') || 
                                    grantedPermissions.includes('instagram_content_publish');
    
    if (!hasPagesPermission) {
      console.log('Missing pages_show_list permission');
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=no_pages_permission`, 302);
    }
    
    if (!hasInstagramPermission) {
      console.log('Missing Instagram permissions');
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=no_instagram_permission`, 302);
    }

    // Step 4: Get user's Facebook pages
    console.log('Fetching Facebook pages...');
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error('Error fetching pages:', pagesData.error);
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=pages_fetch_failed`, 302);
    }

    const pages = pagesData.data || [];
    console.log('Found', pages.length, 'Facebook pages');

    if (pages.length === 0) {
      console.log('No Facebook pages found - user may not be admin of any page');
      
      // Check if business_management was granted
      const hasBusinessManagement = grantedPermissions.includes('business_management');
      console.log('Has business_management for Instagram:', hasBusinessManagement);
      
      if (!hasBusinessManagement) {
        console.log('Missing business_management permission - required for Business Portfolio pages');
        return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=no_business_management`, 302);
      }
      
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=no_pages_found`, 302);
    }

    // Step 4: Find Instagram Business Account connected to pages
    let instagramAccount = null;
    let connectedPage = null;

    for (const page of pages) {
      console.log('Checking page:', page.name, 'for Instagram account...');
      const igResponse = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`
      );
      const igData = await igResponse.json();

      if (igData.instagram_business_account) {
        instagramAccount = igData.instagram_business_account;
        connectedPage = page;
        console.log('Found Instagram account:', instagramAccount.username);
        break;
      }
    }

    if (!instagramAccount) {
      console.log('No Instagram Business Account found');
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=no_instagram_account`, 302);
    }

    // Step 5: Save to database (multi-account support)
    console.log('Saving Instagram token to database...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this Instagram account already exists for this user
    const { data: existingAccount } = await supabase
      .from('instagram_oauth_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('instagram_account_id', instagramAccount.id)
      .maybeSingle();

    if (existingAccount) {
      // Update existing account
      console.log('Updating existing Instagram account:', existingAccount.id);
      const { error: updateError } = await supabase
        .from('instagram_oauth_tokens')
        .update({
          access_token: connectedPage.access_token,
          token_type: 'Bearer',
          expires_at: expiresAt.toISOString(),
          instagram_username: instagramAccount.username,
          facebook_page_id: connectedPage.id,
          scope: 'instagram_basic,instagram_content_publish',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id);

      if (updateError) {
        console.error('Error updating token:', updateError);
        return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=save_failed`, 302);
      }
    } else {
      // Insert new account - never set as default (we publish to all accounts)
      console.log('Inserting new Instagram account');

      const { error: insertError } = await supabase
        .from('instagram_oauth_tokens')
        .insert({
          user_id: userId,
          access_token: connectedPage.access_token,
          token_type: 'Bearer',
          expires_at: expiresAt.toISOString(),
          instagram_account_id: instagramAccount.id,
          instagram_username: instagramAccount.username,
          facebook_page_id: connectedPage.id,
          account_name: instagramAccount.username,
          scope: 'instagram_basic,instagram_content_publish',
          is_default: false, // Never set default - we publish to all accounts
        });

      if (insertError) {
        console.error('Error inserting token:', insertError);
        return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=save_failed`, 302);
      }
    }

    console.log('Instagram connection saved successfully for user:', userId);
    return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=connected`, 302);

  } catch (error) {
    console.error('Unexpected error in instagram-oauth-callback:', error);
    return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?instagram=error&message=unexpected_error`, 302);
  }
});
