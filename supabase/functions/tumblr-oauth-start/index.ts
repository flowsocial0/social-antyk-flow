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

    const TUMBLR_API_KEY = Deno.env.get('TUMBLR_API_KEY');
    if (!TUMBLR_API_KEY) {
      throw new Error('TUMBLR_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/tumblr-oauth-callback`;
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: TUMBLR_API_KEY,
      redirect_uri: redirectUri,
      scope: 'basic write offline_access',
      state: `${state}|${userId}`,
    });

    const authUrl = `https://www.tumblr.com/oauth2/authorize?${params.toString()}`;

    return new Response(
      JSON.stringify({ authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Tumblr OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
