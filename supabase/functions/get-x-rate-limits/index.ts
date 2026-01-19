import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Daily limit for X Free tier
const X_FREE_TIER_DAILY_LIMIT = 17;

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
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get actual publications from last 24h for each account
    const { data: dailyPublications, error: pubError } = await supabaseClient
      .from('x_daily_publications')
      .select('account_id, published_at')
      .in('account_id', accountIds)
      .gte('published_at', twentyFourHoursAgo.toISOString());

    if (pubError) {
      console.error('Error fetching daily publications:', pubError);
    }

    // Group publications by account
    const publicationsByAccount: Record<string, { count: number; oldestTime: Date | null }> = {};
    for (const accountId of accountIds) {
      publicationsByAccount[accountId] = { count: 0, oldestTime: null };
    }

    if (dailyPublications) {
      for (const pub of dailyPublications) {
        if (!publicationsByAccount[pub.account_id]) {
          publicationsByAccount[pub.account_id] = { count: 0, oldestTime: null };
        }
        publicationsByAccount[pub.account_id].count++;
        
        const pubTime = new Date(pub.published_at);
        if (!publicationsByAccount[pub.account_id].oldestTime || 
            pubTime < publicationsByAccount[pub.account_id].oldestTime!) {
          publicationsByAccount[pub.account_id].oldestTime = pubTime;
        }
      }
    }

    // Get old API rate limits (for backwards compatibility, but less useful now)
    const { data: rateLimits, error: limitsError } = await supabaseClient
      .from('x_rate_limits')
      .select('*')
      .in('account_id', accountIds);

    if (limitsError) {
      console.error('Error fetching rate limits:', limitsError);
    }

    // Combine account info with rate limits and daily publication counts
    const accountsWithLimits = xAccounts.map(account => {
      const limits = rateLimits?.filter(rl => rl.account_id === account.id) || [];
      const tweetsLimit = limits.find(l => l.endpoint === 'tweets');
      const dailyPubs = publicationsByAccount[account.id] || { count: 0, oldestTime: null };
      
      // Calculate remaining based on actual publications, not API headers
      const publishedToday = dailyPubs.count;
      const remaining = Math.max(0, X_FREE_TIER_DAILY_LIMIT - publishedToday);
      const isLimited = remaining === 0;
      
      // Calculate reset time - 24h after oldest publication in window
      let resetAt: string | null = null;
      let minutesUntilReset: number | null = null;
      
      if (isLimited && dailyPubs.oldestTime) {
        const resetTime = new Date(dailyPubs.oldestTime.getTime() + 24 * 60 * 60 * 1000);
        resetAt = resetTime.toISOString();
        minutesUntilReset = Math.max(0, Math.ceil((resetTime.getTime() - now.getTime()) / 60000));
      }

      return {
        id: account.id,
        screen_name: account.screen_name,
        account_name: account.account_name,
        tweets: {
          limit_max: X_FREE_TIER_DAILY_LIMIT,
          remaining: remaining,
          published_today: publishedToday,
          reset_at: resetAt,
          is_limited: isLimited,
          minutes_until_reset: minutesUntilReset,
          updated_at: now.toISOString(),
          // Keep old API values for reference
          api_remaining: tweetsLimit?.remaining,
          api_reset_at: tweetsLimit?.reset_at
        }
      };
    });

    // Calculate aggregate info
    const anyLimited = accountsWithLimits.some(a => a.tweets.is_limited);
    const totalRemaining = accountsWithLimits.reduce((sum, a) => sum + a.tweets.remaining, 0);
    const totalPublished = accountsWithLimits.reduce((sum, a) => sum + a.tweets.published_today, 0);
    
    const nextReset = accountsWithLimits
      .filter(a => a.tweets.reset_at)
      .map(a => new Date(a.tweets.reset_at!))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return new Response(
      JSON.stringify({
        success: true,
        accounts: accountsWithLimits,
        summary: {
          total_accounts: accountsWithLimits.length,
          any_limited: anyLimited,
          total_remaining: totalRemaining,
          total_published_today: totalPublished,
          daily_limit: X_FREE_TIER_DAILY_LIMIT,
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
