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

    const GOOGLE_BUSINESS_CLIENT_ID = Deno.env.get('GOOGLE_BUSINESS_CLIENT_ID')!;
    const GOOGLE_BUSINESS_CLIENT_SECRET = Deno.env.get('GOOGLE_BUSINESS_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/google-business-oauth-callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: GOOGLE_BUSINESS_CLIENT_ID,
        client_secret: GOOGLE_BUSINESS_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Google Business token exchange failed:', errorText);
      return Response.redirect(`${siteUrl}/settings/social-accounts?error=token_exchange_failed`, 302);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get account info
    let businessName = null;
    let accountId = null;
    let locationId = null;

    try {
      const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { 'Authorization': `Bearer ${access_token}` },
      });
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        const firstAccount = accountsData.accounts?.[0];
        if (firstAccount) {
          accountId = firstAccount.name;
          businessName = firstAccount.accountName;
        }
      }
    } catch (e) {
      console.error('Error fetching Google Business accounts:', e);
    }

    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    await supabase.from('google_business_tokens').insert({
      user_id: userId,
      access_token,
      refresh_token: refresh_token || null,
      expires_at: expiresAt,
      scope: scope || null,
      account_id: accountId || null,
      location_id: locationId || null,
      business_name: businessName || null,
      account_name: businessName || null,
    });

    return Response.redirect(`${siteUrl}/settings/social-accounts?connected=true&platform=google_business`, 302);
  } catch (error: any) {
    console.error('Google Business OAuth callback error:', error);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://id-preview--c4157687-6f8a-4875-aa6d-ac0c6ad3fb78.lovable.app';
    return Response.redirect(`${siteUrl}/settings/social-accounts?error=callback_failed`, 302);
  }
});
