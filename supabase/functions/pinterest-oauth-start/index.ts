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

    const PINTEREST_APP_ID = Deno.env.get('PINTEREST_APP_ID');
    if (!PINTEREST_APP_ID) {
      throw new Error('PINTEREST_APP_ID is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/pinterest-oauth-callback`;

    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: PINTEREST_APP_ID,
      redirect_uri: redirectUri,
      scope: 'boards:read,pins:read,pins:write,boards:write',
      state: `${state}|${userId}`,
    });

    const authUrl = `https://www.pinterest.com/oauth/?${params.toString()}`;

    return new Response(
      JSON.stringify({ url: authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Pinterest OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
