import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// App-level daily limit for X Free tier
const X_APP_DAILY_LIMIT = 1500;

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

    console.log('Fetching X app rate limits');

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get app-level rate limit from platform_rate_limits table
    // This tracks the shared application limit
    const { data: appRateLimit, error: appLimitError } = await supabaseClient
      .from('platform_rate_limits')
      .select('*')
      .eq('platform', 'x')
      .eq('limit_type', 'app_daily')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appLimitError) {
      console.error('Error fetching app rate limit:', appLimitError);
    }

    // Calculate remaining from actual publications in last 24h if no API data
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Count all X publications across all users in last 24h
    const { count: totalPublications, error: countError } = await supabaseClient
      .from('x_daily_publications')
      .select('*', { count: 'exact', head: true })
      .gte('published_at', twentyFourHoursAgo.toISOString());

    if (countError) {
      console.error('Error counting publications:', countError);
    }

    const published24h = totalPublications || 0;
    
    // Use API data if available and recent, otherwise calculate from publications
    let remaining = X_APP_DAILY_LIMIT - published24h;
    let resetAt: string | null = null;

    if (appRateLimit && appRateLimit.remaining !== null) {
      // Use API-reported limit if it's recent (within 1 hour)
      const lastCheck = appRateLimit.last_api_check ? new Date(appRateLimit.last_api_check) : null;
      const isRecent = lastCheck && (now.getTime() - lastCheck.getTime() < 60 * 60 * 1000);
      
      if (isRecent) {
        remaining = appRateLimit.remaining;
        resetAt = appRateLimit.reset_at;
        console.log('Using API-reported limit:', remaining);
      }
    }

    // If no reset time from API, estimate based on oldest publication
    if (!resetAt && published24h > 0) {
      const { data: oldestPub } = await supabaseClient
        .from('x_daily_publications')
        .select('published_at')
        .gte('published_at', twentyFourHoursAgo.toISOString())
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (oldestPub) {
        const resetTime = new Date(new Date(oldestPub.published_at).getTime() + 24 * 60 * 60 * 1000);
        resetAt = resetTime.toISOString();
      }
    }

    const isLimited = remaining <= 0;

    return new Response(
      JSON.stringify({
        success: true,
        appLimit: {
          remaining: Math.max(0, remaining),
          limit: X_APP_DAILY_LIMIT,
          reset_at: resetAt,
          is_limited: isLimited,
          published_24h: published24h,
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
