import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, codeVerifier, userId, redirectUri } = await req.json();
    
    console.log('TikTok OAuth callback received');
    console.log('User ID:', userId);
    console.log('Code:', code?.substring(0, 20) + '...');

    const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY');
    const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET');
    
    if (!clientKey || !clientSecret) {
      throw new Error('TikTok credentials not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);
    
    if (tokenData.error) {
      console.error('TikTok token error:', tokenData);
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const { access_token, refresh_token, open_id, scope, expires_in } = tokenData;

    if (!access_token || !open_id) {
      console.error('Missing token data:', tokenData);
      throw new Error('Invalid token response from TikTok');
    }

    // Fetch user info to get display name
    let displayName = '';
    try {
      const userInfoResponse = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      );
      const userInfoText = await userInfoResponse.text();
      console.log('TikTok user info raw:', userInfoText);
      const userInfo = JSON.parse(userInfoText);
      displayName = userInfo?.data?.user?.display_name || '';
      console.log('TikTok display name resolved:', displayName);
    } catch (e) {
      console.warn('Could not fetch TikTok user info:', e);
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (expires_in || 86400) * 1000).toISOString();

    // Store token in database using service role (multi-account support)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if this TikTok account already exists for this user
    const { data: existingAccount } = await supabase
      .from('tiktok_oauth_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('open_id', open_id)
      .maybeSingle();

    if (existingAccount) {
      // Update existing account
      console.log('Updating existing TikTok account:', existingAccount.id);
      const { error: updateError } = await supabase
        .from('tiktok_oauth_tokens')
        .update({
          access_token,
          refresh_token,
          scope,
          expires_at: expiresAt,
          account_name: displayName || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error('Failed to update TikTok token');
      }
    } else {
      // Insert new account - never set as default (we publish to all accounts)
      console.log('Inserting new TikTok account');

      const { error: insertError } = await supabase
        .from('tiktok_oauth_tokens')
        .insert({
          user_id: userId,
          access_token,
          refresh_token,
          open_id,
          scope,
          expires_at: expiresAt,
          account_name: displayName || null,
          is_default: false,
        });

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error('Failed to save TikTok token');
      }
    }

    console.log('TikTok token saved successfully for user:', userId);

    return new Response(
      JSON.stringify({ success: true, open_id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('TikTok OAuth callback error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
