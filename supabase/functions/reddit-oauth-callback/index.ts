import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const siteUrl = Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';

    if (error) {
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=${error}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=missing_params`, 302);
    }

    const [, userId] = state.split('|');
    if (!userId) {
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=invalid_state`, 302);
    }

    const REDDIT_CLIENT_ID = Deno.env.get('REDDIT_CLIENT_ID')!;
    const REDDIT_CLIENT_SECRET = Deno.env.get('REDDIT_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/reddit-oauth-callback`;

    // Exchange code for token
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`)}`,
        'User-Agent': 'BookPromoter/1.0',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Reddit token exchange failed:', errorText);
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=token_exchange_failed`, 302);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get user info
    const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'User-Agent': 'BookPromoter/1.0',
      },
    });

    let username = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      username = userData.name;
    }

    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // Save token
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    await supabase.from('reddit_oauth_tokens').insert({
      user_id: userId,
      access_token,
      refresh_token: refresh_token || null,
      expires_at: expiresAt,
      scope: scope || null,
      username: username || null,
      account_name: username ? `u/${username}` : null,
    });

    return Response.redirect(`${siteUrl}/settings/social-accounts?connected=true&platform=reddit`, 302);
  } catch (error: any) {
    console.error('Reddit OAuth callback error:', error);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';
    return Response.redirect(`${siteUrl}/settings/social-accounts?error=callback_failed`, 302);
  }
});
