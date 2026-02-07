import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Threads OAuth callback received:', { code: !!code, state, error });

    if (error) {
      console.log('User cancelled or error:', error);
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=cancelled`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=error&message=missing_params`, 302);
    }

    const userId = state.split('_')[0];
    if (!userId) {
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=error&message=invalid_state`, 302);
    }

    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    const redirectUri = `https://dmrfbokchkxjzslfzeps.supabase.co/functions/v1/threads-oauth-callback`;

    if (!appId || !appSecret) {
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=error&message=server_config`, 302);
    }

    // Step 1: Exchange code for short-lived token
    console.log('Exchanging code for Threads access token...');
    const tokenResponse = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response:', { user_id: tokenData.user_id, hasToken: !!tokenData.access_token });

    if (tokenData.error) {
      console.error('Error getting access token:', tokenData.error);
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=error&message=token_exchange_failed`, 302);
    }

    const shortLivedToken = tokenData.access_token;
    const threadsUserId = tokenData.user_id;

    // Step 2: Exchange for long-lived token
    console.log('Exchanging for long-lived Threads token...');
    const longLivedUrl = new URL('https://graph.threads.net/access_token');
    longLivedUrl.searchParams.set('grant_type', 'th_exchange_token');
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('access_token', shortLivedToken);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    if (longLivedData.error) {
      console.error('Error getting long-lived token:', longLivedData.error);
      return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=error&message=long_token_failed`, 302);
    }

    const accessToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in || 5184000;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Step 3: Get user profile
    console.log('Fetching Threads user profile...');
    const profileResponse = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`
    );
    const profileData = await profileResponse.json();
    const username = profileData.username || threadsUserId;
    console.log('Threads username:', username);

    // Step 4: Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this Threads account already exists for this user
    const { data: existingAccount } = await supabase
      .from('threads_oauth_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('threads_user_id', String(threadsUserId))
      .maybeSingle();

    if (existingAccount) {
      const { error: updateError } = await supabase
        .from('threads_oauth_tokens')
        .update({
          access_token: accessToken,
          expires_at: expiresAt.toISOString(),
          username,
          account_name: username,
          scope: 'threads_basic,threads_content_publish,threads_manage_replies',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id);

      if (updateError) {
        console.error('Error updating token:', updateError);
        return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=error&message=save_failed`, 302);
      }
    } else {
      const { error: insertError } = await supabase
        .from('threads_oauth_tokens')
        .insert({
          user_id: userId,
          threads_user_id: String(threadsUserId),
          access_token: accessToken,
          token_type: 'Bearer',
          expires_at: expiresAt.toISOString(),
          username,
          account_name: username,
          is_default: false,
          scope: 'threads_basic,threads_content_publish,threads_manage_replies',
        });

      if (insertError) {
        console.error('Error inserting token:', insertError);
        return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=error&message=save_failed`, 302);
      }
    }

    console.log('Threads connection saved successfully for user:', userId);
    return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=connected`, 302);

  } catch (error) {
    console.error('Unexpected error in threads-oauth-callback:', error);
    return Response.redirect(`${FRONTEND_URL}/settings/social-accounts?threads=error&message=unexpected_error`, 302);
  }
});
