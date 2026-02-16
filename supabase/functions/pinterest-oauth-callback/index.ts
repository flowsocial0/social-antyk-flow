import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FALLBACK_URL = 'https://socialautoflow.pl';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const siteUrl = Deno.env.get('SITE_URL') || FALLBACK_URL;

    if (!code || !state) {
      return Response.redirect(`${siteUrl}/platforms/pinterest?error=missing_params`, 302);
    }

    const [, userId] = state.split('|');
    if (!userId) {
      return Response.redirect(`${siteUrl}/platforms/pinterest?error=invalid_state`, 302);
    }

    const PINTEREST_APP_ID = Deno.env.get('PINTEREST_APP_ID')!;
    const PINTEREST_APP_SECRET = Deno.env.get('PINTEREST_APP_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/pinterest-oauth-callback`;

    // Exchange code for token
    const tokenResponse = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${PINTEREST_APP_ID}:${PINTEREST_APP_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Pinterest token exchange failed:', errorText);
      return Response.redirect(`${siteUrl}/platforms/pinterest?error=token_exchange_failed`, 302);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get user info
    const userResponse = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    let username = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      username = userData.username;
    }

    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // Save token - check if existing token has sandbox mode enabled
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Check existing token to preserve sandbox settings
    const { data: existingTokens } = await supabase
      .from('pinterest_oauth_tokens')
      .select('id, is_sandbox, access_token')
      .eq('user_id', userId);

    const existingToken = existingTokens?.[0];

    if (existingToken?.is_sandbox) {
      // User has sandbox mode - DON'T overwrite their sandbox token
      // Only update metadata (username, expiry, scope) but keep sandbox access_token
      console.log('Preserving sandbox token, only updating metadata');
      await supabase
        .from('pinterest_oauth_tokens')
        .update({
          refresh_token: refresh_token || null,
          expires_at: expiresAt,
          scope: scope || null,
          username: username || existingToken.access_token ? undefined : (username || null),
          account_name: username || null,
        })
        .eq('id', existingToken.id);
    } else {
      // No sandbox mode - normal upsert with production token
      const { error: upsertError } = await supabase
        .from('pinterest_oauth_tokens')
        .upsert({
          user_id: userId,
          access_token,
          refresh_token: refresh_token || null,
          expires_at: expiresAt,
          scope: scope || null,
          username: username || null,
          account_name: username || null,
          is_sandbox: false,
        }, { onConflict: 'user_id' });

      if (upsertError) {
        await supabase.from('pinterest_oauth_tokens').insert({
          user_id: userId,
          access_token,
          refresh_token: refresh_token || null,
          expires_at: expiresAt,
          scope: scope || null,
          username: username || null,
          account_name: username || null,
        });
      }
    }

    return Response.redirect(`${siteUrl}/platforms/pinterest?connected=true&platform=pinterest`, 302);
  } catch (error: any) {
    console.error('Pinterest OAuth callback error:', error);
    const siteUrl = Deno.env.get('SITE_URL') || FALLBACK_URL;
    return Response.redirect(`${siteUrl}/platforms/pinterest?error=callback_failed`, 302);
  }
});
