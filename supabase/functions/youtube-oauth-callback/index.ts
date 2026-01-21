import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_CLIENT_ID = Deno.env.get('YOUTUBE_CLIENT_ID');
const YOUTUBE_CLIENT_SECRET = Deno.env.get('YOUTUBE_CLIENT_SECRET');

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
      console.error('Missing YouTube OAuth environment variables');
      throw new Error('YouTube OAuth not configured');
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client with user auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Not authenticated');
    }

    const { code, redirectUri } = await req.json();

    if (!code) {
      throw new Error('Missing authorization code');
    }

    console.log('Processing YouTube OAuth callback for user:', user.id);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: YOUTUBE_CLIENT_ID,
        client_secret: YOUTUBE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      throw new Error(tokenData.error_description || tokenData.error);
    }

    console.log('Successfully exchanged code for tokens');

    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Fetch channel information
    let channelId = null;
    let channelTitle = null;

    try {
      const channelResponse = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      );

      const channelData = await channelResponse.json();
      
      if (channelData.items && channelData.items.length > 0) {
        channelId = channelData.items[0].id;
        channelTitle = channelData.items[0].snippet.title;
        console.log('Found YouTube channel:', channelTitle);
      }
    } catch (channelError) {
      console.error('Error fetching channel info:', channelError);
      // Continue without channel info
    }

    // Store tokens using service role for database access (multi-account support)
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

    // Check if this YouTube channel already exists for this user
    const { data: existingAccount } = await supabaseAdmin
      .from('youtube_oauth_tokens')
      .select('id')
      .eq('user_id', user.id)
      .eq('channel_id', channelId)
      .maybeSingle();

    if (existingAccount) {
      // Update existing account
      console.log('Updating existing YouTube account:', existingAccount.id);
      const { error: updateError } = await supabaseAdmin
        .from('youtube_oauth_tokens')
        .update({
          access_token,
          refresh_token,
          token_type: 'Bearer',
          expires_at: expiresAt,
          channel_title: channelTitle,
          scope,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id);

      if (updateError) {
        console.error('Error updating tokens:', updateError);
        throw new Error('Failed to update tokens');
      }
    } else {
      // Insert new account - never set as default (we publish to all accounts)
      console.log('Inserting new YouTube account');

      const { error: insertError } = await supabaseAdmin
        .from('youtube_oauth_tokens')
        .insert({
          user_id: user.id,
          access_token,
          refresh_token,
          token_type: 'Bearer',
          expires_at: expiresAt,
          channel_id: channelId,
          channel_title: channelTitle,
          account_name: channelTitle,
          scope,
          is_default: false, // Never set default - we publish to all accounts
        });

      if (insertError) {
        console.error('Error inserting tokens:', insertError);
        throw new Error('Failed to store tokens');
      }
    }

    console.log('YouTube OAuth completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        channelId,
        channelTitle,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in youtube-oauth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
