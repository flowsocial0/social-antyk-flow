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
    console.log('=== Facebook Data Deletion Request ===');
    
    // Facebook sends signed_request parameter
    const body = await req.json();
    const { signed_request } = body;
    
    console.log('Received signed request:', signed_request ? 'present' : 'missing');

    if (!signed_request) {
      return new Response(
        JSON.stringify({ error: 'Missing signed_request parameter' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Parse the signed request
    const [encodedSig, payload] = signed_request.split('.');
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    
    console.log('Facebook User ID from signed request:', data.user_id);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete user's Facebook tokens
    const { error: deleteError } = await supabase
      .from('facebook_oauth_tokens')
      .delete()
      .eq('page_id', data.user_id);

    if (deleteError) {
      console.error('Error deleting Facebook tokens:', deleteError);
    } else {
      console.log('Successfully deleted Facebook tokens for user:', data.user_id);
    }

    // Generate a confirmation code (Facebook requires this)
    const confirmationCode = `${data.user_id}_${Date.now()}`;
    
    console.log('Data deletion confirmation code:', confirmationCode);

    // Return the required response format
    return new Response(
      JSON.stringify({
        url: `https://social-auto-flow.netlify.app/data-deletion?confirmation=${confirmationCode}`,
        confirmation_code: confirmationCode
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in facebook-data-deletion:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
