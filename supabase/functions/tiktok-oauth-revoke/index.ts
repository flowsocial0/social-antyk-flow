import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== TikTok OAuth Revoke Request ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')!;
    const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET')!;

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Brak autoryzacji');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Użytkownik nie zalogowany');
    }

    console.log('User ID:', user.id);

    // Get token from DB using service role
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('tiktok_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tokenError) {
      console.error('Token fetch error:', tokenError);
      throw new Error('Błąd pobierania tokena');
    }

    if (!tokenData) {
      console.log('No token found, nothing to revoke');
      return new Response(
        JSON.stringify({ success: true, message: 'Konto TikTok nie było połączone' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call TikTok revoke endpoint
    console.log('Revoking TikTok token...');
    
    const revokeResponse = await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        token: tokenData.access_token,
      }).toString(),
    });

    const revokeData = await revokeResponse.json();
    console.log('TikTok revoke response:', JSON.stringify(revokeData, null, 2));

    // Even if revoke fails (e.g., token already expired), we still delete from DB
    if (revokeData.error) {
      console.warn('TikTok revoke returned error (continuing with DB delete):', revokeData.error);
    }

    // Delete token from database
    const { error: deleteError } = await supabase
      .from('tiktok_oauth_tokens')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Delete token error:', deleteError);
      throw new Error('Błąd usuwania tokena z bazy');
    }

    console.log('TikTok token revoked and deleted successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Konto TikTok odłączone pomyślnie',
        revokeResult: revokeData.error ? 'Token mógł już wygasnąć' : 'Token odwołany w TikTok'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('TikTok OAuth revoke error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
