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
    console.log('=== Facebook Select Page ===');
    
    const { userId, pageId, pageName, pageAccessToken } = await req.json();
    
    console.log('Received selection:', { userId, pageId, pageName });

    if (!userId || !pageId || !pageName || !pageAccessToken) {
      throw new Error('Missing required parameters: userId, pageId, pageName, pageAccessToken');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate expiration (long-lived page tokens are actually never-expiring)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // Store Page Access Token (upsert based on user_id)
    console.log('Storing token for userId:', userId, 'pageId:', pageId, 'pageName:', pageName);
    
    const { data: tokenRecord, error: insertError } = await supabase
      .from('facebook_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: pageAccessToken,
        token_type: 'Bearer',
        expires_at: expiresAt.toISOString(),
        page_id: pageId,
        page_name: pageName,
        scope: 'pages_manage_posts,pages_read_engagement'
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing Facebook token:', insertError);
      throw new Error('Failed to store Facebook token: ' + insertError.message);
    }

    console.log('Successfully stored Facebook Page token:', tokenRecord);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Page connected successfully',
        page_name: pageName 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Facebook select page error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
