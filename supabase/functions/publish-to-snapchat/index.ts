import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { testConnection, bookId, contentId, campaignPostId, userId, accountId, imageUrl } = body;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        effectiveUserId = user?.id;
      }
    }
    if (!effectiveUserId) throw new Error('User ID is required');

    let query = supabase.from('snapchat_oauth_tokens').select('*').eq('user_id', effectiveUserId);
    if (accountId) query = query.eq('id', accountId);
    const { data: tokens } = await query;
    if (!tokens || tokens.length === 0) throw new Error('No Snapchat account connected');

    if (testConnection) {
      const token = tokens[0];
      const response = await fetch('https://adsapi.snapchat.com/v1/me', {
        headers: { 'Authorization': `Bearer ${token.access_token}` },
      });
      return new Response(
        JSON.stringify({ connected: response.ok, display_name: tokens[0].display_name }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Snapchat Business API publishing is complex and requires specific setup
    // This is a placeholder - real implementation needs media upload + story creation
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Snapchat publishing requires Business API setup with specific organization and public profile configuration. Please configure in Snap Business Manager first.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Snapchat publish error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
