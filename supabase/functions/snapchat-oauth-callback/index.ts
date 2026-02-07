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

    const SNAPCHAT_CLIENT_ID = Deno.env.get('SNAPCHAT_CLIENT_ID')!;
    const SNAPCHAT_CLIENT_SECRET = Deno.env.get('SNAPCHAT_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/snapchat-oauth-callback`;

    const tokenResponse = await fetch('https://accounts.snapchat.com/login/oauth2/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${SNAPCHAT_CLIENT_ID}:${SNAPCHAT_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Snapchat token exchange failed:', errorText);
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=token_exchange_failed`, 302);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get user info
    const meResponse = await fetch('https://adsapi.snapchat.com/v1/me', {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    let displayName = null;
    let organizationId = null;
    if (meResponse.ok) {
      const meData = await meResponse.json();
      displayName = meData.me?.display_name;
      organizationId = meData.me?.organization_id;
    }

    const expiresAt = new Date(Date.now() + (expires_in || 1800) * 1000).toISOString();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    await supabase.from('snapchat_oauth_tokens').insert({
      user_id: userId,
      access_token,
      refresh_token: refresh_token || null,
      expires_at: expiresAt,
      scope: scope || null,
      display_name: displayName || null,
      organization_id: organizationId || null,
      account_name: displayName || null,
    });

    return Response.redirect(`${siteUrl}/settings/social-accounts?connected=true&platform=snapchat`, 302);
  } catch (error: any) {
    console.error('Snapchat OAuth callback error:', error);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';
    return Response.redirect(`${siteUrl}/settings/social-accounts?error=callback_failed`, 302);
  }
});
