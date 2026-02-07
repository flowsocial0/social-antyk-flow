import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';

    if (!code || !state) {
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=missing_params`, 302);
    }

    const [, userId] = state.split('|');
    if (!userId) {
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=invalid_state`, 302);
    }

    const TUMBLR_API_KEY = Deno.env.get('TUMBLR_API_KEY')!;
    const TUMBLR_API_SECRET = Deno.env.get('TUMBLR_API_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/tumblr-oauth-callback`;

    // Exchange code for token
    const tokenResponse = await fetch('https://api.tumblr.com/v2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: TUMBLR_API_KEY,
        client_secret: TUMBLR_API_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Tumblr token exchange failed:', errorText);
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=token_exchange_failed`, 302);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get user info
    const userResponse = await fetch('https://api.tumblr.com/v2/user/info', {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    let blogName = null;
    let username = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      username = userData.response?.user?.name;
      blogName = userData.response?.user?.blogs?.[0]?.name;
    }

    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    await supabase.from('tumblr_oauth_tokens').insert({
      user_id: userId,
      access_token,
      refresh_token: refresh_token || null,
      expires_at: expiresAt,
      scope: scope || null,
      blog_name: blogName || null,
      username: username || null,
      account_name: username || blogName || null,
    });

    return Response.redirect(`${siteUrl}/settings/social-accounts?connected=true&platform=tumblr`, 302);
  } catch (error: any) {
    console.error('Tumblr OAuth callback error:', error);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';
    return Response.redirect(`${siteUrl}/settings/social-accounts?error=callback_failed`, 302);
  }
});
