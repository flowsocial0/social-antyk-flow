import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      return Response.redirect(`${Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app'}/settings/social-accounts?error=missing_params`, 302);
    }

    const [, userId] = state.split('|');
    if (!userId) {
      return Response.redirect(`${Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app'}/settings/social-accounts?error=invalid_state`, 302);
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
      return Response.redirect(`${Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app'}/settings/social-accounts?error=token_exchange_failed`, 302);
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

    // Save token
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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
      }, { onConflict: 'user_id' });

    if (upsertError) {
      // If conflict on user_id, insert as additional account
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

    const siteUrl = Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';
    return Response.redirect(`${siteUrl}/settings/social-accounts?connected=true&platform=pinterest`, 302);
  } catch (error: any) {
    console.error('Pinterest OAuth callback error:', error);
    return Response.redirect(`${Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app'}/settings/social-accounts?error=callback_failed`, 302);
  }
});
