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
    const { userId } = await req.json();

    const REDDIT_CLIENT_ID = Deno.env.get('REDDIT_CLIENT_ID');
    if (!REDDIT_CLIENT_ID) {
      throw new Error('REDDIT_CLIENT_ID is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/reddit-oauth-callback`;

    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: REDDIT_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'submit read identity',
      state: `${state}|${userId}`,
      duration: 'permanent',
    });

    const authUrl = `https://www.reddit.com/api/v1/authorize?${params.toString()}`;

    return new Response(
      JSON.stringify({ url: authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Reddit OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
