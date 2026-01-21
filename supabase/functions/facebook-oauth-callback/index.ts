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
    console.log('=== Facebook OAuth Callback ===');
    
    // Get code and state from query parameters (Facebook sends them via GET)
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

    const FRONTEND_URL_RAW = Deno.env.get('FRONTEND_URL') || 'https://social-auto-flow.netlify.app';
    // Remove trailing slash to avoid double slashes in URLs
    const FRONTEND_URL = FRONTEND_URL_RAW.replace(/\/$/, '');

    // Check if user cancelled or Facebook returned an error FIRST
    if (errorParam) {
      console.log('User cancelled or error from Facebook:', errorParam, errorDescription);
      const redirectUrl = new URL(`${FRONTEND_URL}/platforms/facebook`);
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

    const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID');
    const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET');
    const FACEBOOK_REDIRECT_URI = Deno.env.get('FACEBOOK_REDIRECT_URI');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET || !FACEBOOK_REDIRECT_URI) {
      throw new Error('Missing Facebook OAuth environment variables');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Exchanging Facebook code for token...');

    // Step 1: Exchange code for short-lived access token
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    tokenUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', FACEBOOK_REDIRECT_URI);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error('Facebook token exchange error:', tokenData);
      throw new Error(tokenData.error?.message || 'Failed to exchange code for token');
    }

    const shortLivedToken = tokenData.access_token;
    console.log('Obtained short-lived token');

    // Step 2: Exchange for long-lived token
    const longLivedUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    longLivedUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET);
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    if (!longLivedResponse.ok || longLivedData.error) {
      console.error('Facebook long-lived token error:', longLivedData);
      throw new Error(longLivedData.error?.message || 'Failed to get long-lived token');
    }

    const longLivedToken = longLivedData.access_token;
    console.log('Obtained long-lived user token');

    // Step 3: Get user's pages with additional fields for debugging
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedToken}&fields=id,name,category,access_token,tasks`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    // Enhanced logging for debugging
    console.log('=== Facebook Pages Response Debug ===');
    console.log('Pages response status:', pagesResponse.status);
    console.log('Full pages response:', JSON.stringify(pagesData));
    console.log('Pages data.data:', pagesData.data);
    console.log('Pages data.data length:', pagesData.data?.length || 0);

    if (!pagesResponse.ok || pagesData.error) {
      console.error('Facebook pages error:', pagesData);
      throw new Error(pagesData.error?.message || 'Failed to get user pages');
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      // Additional debugging - get user info to understand the account
      console.log('No pages found - fetching user info for diagnostics...');
      const userInfoUrl = `https://graph.facebook.com/v18.0/me?access_token=${longLivedToken}&fields=id,name,email`;
      const userInfoResponse = await fetch(userInfoUrl);
      const userInfo = await userInfoResponse.json();
      console.log('User info from Facebook:', JSON.stringify(userInfo));
      
      // Check granted permissions
      const permissionsUrl = `https://graph.facebook.com/v18.0/me/permissions?access_token=${longLivedToken}`;
      const permissionsResponse = await fetch(permissionsUrl);
      const permissionsData = await permissionsResponse.json();
      console.log('Granted permissions:', JSON.stringify(permissionsData));
      
      throw new Error(
        'Nie znaleziono żadnych stron Facebook, do których masz uprawnienia administratora. ' +
        'Upewnij się, że: 1) Jesteś administratorem lub redaktorem przynajmniej jednej strony Facebook (nie profilu osobistego), ' +
        '2) Strona jest aktywna i opublikowana, ' +
        '3) W poprzednim kroku zaakceptowałeś uprawnienia do zarządzania stronami (pages_show_list, pages_manage_posts). ' +
        'Jeśli problem się powtarza, spróbuj usunąć aplikację z ustawień Facebooka i połączyć się ponownie.'
      );
    }

    const pages = pagesData.data;
    console.log(`Found ${pages.length} Facebook Page(s)`);

    // Helper function to save a single page (INSERT or UPDATE based on page_id)
    const savePage = async (page: any, setAsDefault: boolean = false) => {
      const pageAccessToken = page.access_token;
      const pageId = page.id;
      const pageName = page.name;

      console.log('Saving page:', pageName, pageId, 'setAsDefault:', setAsDefault);

      // Calculate expiration (long-lived tokens last ~60 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);

      // Check if this specific page is already connected for this user
      const { data: existingPage } = await supabase
        .from('facebook_oauth_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('page_id', pageId)
        .maybeSingle();

      if (existingPage) {
        // Update existing page token
        console.log('Page already exists, updating token for:', pageName);
        const { error: updateError } = await supabase
          .from('facebook_oauth_tokens')
          .update({
            access_token: pageAccessToken,
            expires_at: expiresAt.toISOString(),
            page_name: pageName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPage.id);

        if (updateError) {
          console.error('Error updating Facebook token:', updateError);
          throw new Error('Failed to update Facebook token: ' + updateError.message);
        }
        return existingPage.id;
      } else {
        // Check if user has any pages already (for is_default logic)
        const { count } = await supabase
          .from('facebook_oauth_tokens')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const isDefault = setAsDefault || (count === 0);

        // Insert new page
        console.log('Inserting new page:', pageName, 'isDefault:', isDefault);
        const { data: newToken, error: insertError } = await supabase
          .from('facebook_oauth_tokens')
          .insert({
            user_id: userId,
            access_token: pageAccessToken,
            token_type: 'Bearer',
            expires_at: expiresAt.toISOString(),
            page_id: pageId,
            page_name: pageName,
            scope: 'pages_manage_posts,pages_read_engagement',
            is_default: isDefault,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error storing Facebook token:', insertError);
          throw new Error('Failed to store Facebook token: ' + insertError.message);
        }
        return newToken.id;
      }
    };

    // If only one page, save it automatically
    if (pages.length === 1) {
      const page = pages[0];
      console.log('Single page found, saving automatically:', page.name, page.id);

      await savePage(page, true);

      // Redirect user back to the application
      const redirectUrl = new URL(`${FRONTEND_URL}/platforms/facebook`);
      redirectUrl.searchParams.set('connected', 'true');
      redirectUrl.searchParams.set('page_name', page.name);
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl.toString(),
        },
      });
    }

    // Multiple pages found - save to database and redirect to selection page
    console.log('Multiple pages found, saving to database and redirecting to selection page');
    
    // Prepare pages data
    const pagesForSelection = pages.map((page: any) => ({
      id: page.id,
      name: page.name,
      category: page.category || null,
      access_token: page.access_token
    }));

    // Generate unique session ID and save pages data to database
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiration

    const { error: insertError } = await supabase
      .from('facebook_page_selections')
      .insert({
        id: sessionId,
        user_id: userId,
        pages_data: pagesForSelection,
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('Error saving page selections:', insertError);
      throw new Error('Failed to save page selections: ' + insertError.message);
    }

    console.log('Saved page selections with session ID:', sessionId);
    
    const redirectUrl = new URL(`${FRONTEND_URL}/platforms/facebook/select-page`);
    redirectUrl.searchParams.set('session_id', sessionId);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl.toString(),
      },
    });

  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const FRONTEND_URL_FALLBACK = (Deno.env.get('FRONTEND_URL') || 'https://social-auto-flow.netlify.app').replace(/\/$/, '');
    
    // Redirect back to app with error
    const redirectUrl = new URL(`${FRONTEND_URL_FALLBACK}/platforms/facebook`);
    redirectUrl.searchParams.set('error', errorMessage);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl.toString(),
      },
    });
  }
});
