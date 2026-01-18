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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;
    console.log('Fetching X rate limits for user:', userId);

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's X accounts
    const { data: xAccounts, error: accountsError } = await supabaseClient
      .from('twitter_oauth1_tokens')
      .select('id, screen_name, account_name')
      .eq('user_id', userId);

    if (accountsError) {
      console.error('Error fetching X accounts:', accountsError);
      throw accountsError;
    }

    if (!xAccounts || xAccounts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          accounts: [],
          message: 'No X accounts connected'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountIds = xAccounts.map(a => a.id);

    // Get rate limits for user's accounts
    const { data: rateLimits, error: limitsError } = await supabaseClient
      .from('x_rate_limits')
      .select('*')
      .in('account_id', accountIds);

    if (limitsError) {
      console.error('Error fetching rate limits:', limitsError);
      throw limitsError;
    }

    // Combine account info with rate limits
    const accountsWithLimits = xAccounts.map(account => {
      const limits = rateLimits?.filter(rl => rl.account_id === account.id) || [];
      const tweetsLimit = limits.find(l => l.endpoint === 'tweets');
      
      const now = new Date();
      const resetAt = tweetsLimit?.reset_at ? new Date(tweetsLimit.reset_at) : null;
      const isLimited = tweetsLimit?.remaining === 0 && resetAt && resetAt > now;
      const minutesUntilReset = resetAt ? Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / 60000)) : null;

      return {
        id: account.id,
        screen_name: account.screen_name,
        account_name: account.account_name,
        tweets: tweetsLimit ? {
          limit_max: tweetsLimit.limit_max,
          remaining: tweetsLimit.remaining,
          reset_at: tweetsLimit.reset_at,
          is_limited: isLimited,
          minutes_until_reset: minutesUntilReset,
          updated_at: tweetsLimit.updated_at
        } : null
      };
    });

    // Calculate aggregate info
    const anyLimited = accountsWithLimits.some(a => a.tweets?.is_limited);
    const totalRemaining = accountsWithLimits.reduce((sum, a) => sum + (a.tweets?.remaining ?? 0), 0);
    const nextReset = accountsWithLimits
      .filter(a => a.tweets?.reset_at)
      .map(a => new Date(a.tweets!.reset_at!))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return new Response(
      JSON.stringify({
        success: true,
        accounts: accountsWithLimits,
        summary: {
          total_accounts: accountsWithLimits.length,
          any_limited: anyLimited,
          total_remaining: totalRemaining,
          next_reset: nextReset?.toISOString() || null
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-x-rate-limits:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
