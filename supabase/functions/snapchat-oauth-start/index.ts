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

    const SNAPCHAT_CLIENT_ID = Deno.env.get('SNAPCHAT_CLIENT_ID');
    if (!SNAPCHAT_CLIENT_ID) throw new Error('SNAPCHAT_CLIENT_ID is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/snapchat-oauth-callback`;
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: SNAPCHAT_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'snapchat-marketing-api',
      state: `${state}|${userId}`,
    });

    const authUrl = `https://accounts.snapchat.com/login/oauth2/authorize?${params.toString()}`;

    return new Response(
      JSON.stringify({ url: authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Snapchat OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
