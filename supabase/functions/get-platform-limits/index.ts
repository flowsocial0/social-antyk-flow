import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform limits configuration
const PLATFORM_LIMITS = {
  x: {
    free: {
      daily: 17,      // 17 tweets per 24h
      monthly: 500,   // 500 tweets per month (estimated for free tier)
    },
    basic: {
      daily: 100,     // Basic tier
      monthly: 3000,
    }
  },
  facebook: {
    daily: 200,       // Reasonable daily limit (API-based, usually flexible)
    hourly: 200,      // Rate limit per hour
  },
  instagram: {
    daily: 25,        // 25 posts per 24h
    hourly: 200,      // API calls per hour
  },
  tiktok: {
    daily: 15,        // TikTok daily video upload limit
  },
  youtube: {
    daily: 6,         // Practical upload limit
    quota: 10000,     // Daily quota units
    upload_cost: 1600,// Cost per video upload
  }
};

// X OAuth signature generation for API pre-check
const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");
  
  return signature;
}

function generateOAuthHeader(
  method: string, 
  url: string, 
  userAccessToken: string, 
  userAccessTokenSecret: string
): string {
  const oauthParams = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: userAccessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    API_SECRET!,
    userAccessTokenSecret
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    "OAuth " +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

// Fetch X limits from API headers
async function fetchXLimitsFromAPI(
  oauth_token: string,
  oauth_token_secret: string
): Promise<{
  appDaily: { remaining: number; limit: number; resetAt: string | null };
  userDaily: { remaining: number; limit: number; resetAt: string | null };
} | null> {
  if (!API_KEY || !API_SECRET) {
    console.log('X API credentials not configured');
    return null;
  }

  try {
    const url = "https://api.x.com/2/users/me";
    const method = "GET";
    const header = generateOAuthHeader(method, url, oauth_token, oauth_token_secret);
    
    const response = await fetch(url, {
      method,
      headers: { Authorization: header }
    });

    // Parse rate limit headers
    const appRemaining = response.headers.get('x-app-limit-24hour-remaining');
    const appLimit = response.headers.get('x-app-limit-24hour-limit');
    const appReset = response.headers.get('x-app-limit-24hour-reset');
    
    const userRemaining = response.headers.get('x-user-limit-24hour-remaining');
    const userLimit = response.headers.get('x-user-limit-24hour-limit');
    const userReset = response.headers.get('x-user-limit-24hour-reset');

    console.log('X API rate limit headers:', {
      appRemaining, appLimit, appReset,
      userRemaining, userLimit, userReset
    });

    return {
      appDaily: {
        remaining: appRemaining ? parseInt(appRemaining) : PLATFORM_LIMITS.x.free.daily,
        limit: appLimit ? parseInt(appLimit) : PLATFORM_LIMITS.x.free.daily,
        resetAt: appReset ? new Date(parseInt(appReset) * 1000).toISOString() : null
      },
      userDaily: {
        remaining: userRemaining ? parseInt(userRemaining) : PLATFORM_LIMITS.x.free.daily,
        limit: userLimit ? parseInt(userLimit) : PLATFORM_LIMITS.x.free.daily,
        resetAt: userReset ? new Date(parseInt(userReset) * 1000).toISOString() : null
      }
    };
  } catch (error) {
    console.error('Error fetching X API limits:', error);
    return null;
  }
}

interface PlatformLimits {
  platform: string;
  account_id: string;
  account_name: string;
  limits: {
    type: string;
    name: string;
    limit_max: number;
    used: number;
    remaining: number;
    percentage_used: number;
    reset_at: string | null;
    source: 'api' | 'internal' | 'estimated';
  }[];
  is_limited: boolean;
  total_published_today: number;
  total_published_month: number;
}

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
    console.log('Fetching platform limits for user:', userId);

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all connected accounts for each platform
    const [xAccounts, fbAccounts, igAccounts, ttAccounts, ytAccounts] = await Promise.all([
      supabaseClient.from('twitter_oauth1_tokens')
        .select('id, screen_name, account_name, oauth_token, oauth_token_secret')
        .eq('user_id', userId),
      supabaseClient.from('facebook_oauth_tokens')
        .select('id, page_name, account_name')
        .eq('user_id', userId),
      supabaseClient.from('instagram_oauth_tokens')
        .select('id, instagram_username, account_name')
        .eq('user_id', userId),
      supabaseClient.from('tiktok_oauth_tokens')
        .select('id, account_name')
        .eq('user_id', userId),
      supabaseClient.from('youtube_oauth_tokens')
        .select('id, channel_title, account_name')
        .eq('user_id', userId),
    ]);

    // Collect all account IDs
    const allAccountIds: string[] = [
      ...(xAccounts.data?.map(a => a.id) || []),
      ...(fbAccounts.data?.map(a => a.id) || []),
      ...(igAccounts.data?.map(a => a.id) || []),
      ...(ttAccounts.data?.map(a => a.id) || []),
      ...(ytAccounts.data?.map(a => a.id) || []),
    ];

    // Fetch all publications for all accounts (last 30 days)
    const { data: publications } = await supabaseClient
      .from('platform_publications')
      .select('account_id, platform, published_at, quota_cost')
      .in('account_id', allAccountIds.length > 0 ? allAccountIds : ['none'])
      .gte('published_at', thirtyDaysAgo.toISOString());

    // Also fetch from x_daily_publications for backwards compatibility
    const { data: xDailyPubs } = await supabaseClient
      .from('x_daily_publications')
      .select('account_id, published_at')
      .in('account_id', xAccounts.data?.map(a => a.id) || ['none'])
      .gte('published_at', thirtyDaysAgo.toISOString());

    // Group publications by account
    const pubsByAccount: Record<string, { daily: number; monthly: number; quotaUsed: number }> = {};
    
    // Process unified publications
    if (publications) {
      for (const pub of publications) {
        if (!pubsByAccount[pub.account_id]) {
          pubsByAccount[pub.account_id] = { daily: 0, monthly: 0, quotaUsed: 0 };
        }
        const pubDate = new Date(pub.published_at);
        if (pubDate >= twentyFourHoursAgo) {
          pubsByAccount[pub.account_id].daily++;
        }
        pubsByAccount[pub.account_id].monthly++;
        pubsByAccount[pub.account_id].quotaUsed += pub.quota_cost || 1;
      }
    }

    // Process X daily publications (legacy)
    if (xDailyPubs) {
      for (const pub of xDailyPubs) {
        if (!pubsByAccount[pub.account_id]) {
          pubsByAccount[pub.account_id] = { daily: 0, monthly: 0, quotaUsed: 0 };
        }
        const pubDate = new Date(pub.published_at);
        if (pubDate >= twentyFourHoursAgo) {
          pubsByAccount[pub.account_id].daily++;
        }
        pubsByAccount[pub.account_id].monthly++;
        pubsByAccount[pub.account_id].quotaUsed++;
      }
    }

    const platformResults: PlatformLimits[] = [];

    // Process X accounts
    if (xAccounts.data) {
      for (const account of xAccounts.data) {
        const pubs = pubsByAccount[account.id] || { daily: 0, monthly: 0, quotaUsed: 0 };
        
        // Try to get real limits from X API
        let apiLimits = null;
        try {
          if (account.oauth_token && account.oauth_token_secret) {
            apiLimits = await fetchXLimitsFromAPI(account.oauth_token, account.oauth_token_secret);
          }
        } catch (e) {
          console.error('Failed to fetch X API limits:', e);
        }

        const limits: PlatformLimits['limits'] = [];
        
        // Daily limit (from API or internal tracking)
        if (apiLimits) {
          const effectiveRemaining = Math.min(apiLimits.appDaily.remaining, apiLimits.userDaily.remaining);
          const effectiveLimit = Math.min(apiLimits.appDaily.limit, apiLimits.userDaily.limit);
          limits.push({
            type: 'daily',
            name: 'Tweety (24h)',
            limit_max: effectiveLimit,
            used: effectiveLimit - effectiveRemaining,
            remaining: effectiveRemaining,
            percentage_used: Math.round(((effectiveLimit - effectiveRemaining) / effectiveLimit) * 100),
            reset_at: apiLimits.appDaily.resetAt || apiLimits.userDaily.resetAt,
            source: 'api'
          });
        } else {
          // Fallback to internal tracking
          limits.push({
            type: 'daily',
            name: 'Tweety (24h)',
            limit_max: PLATFORM_LIMITS.x.free.daily,
            used: pubs.daily,
            remaining: Math.max(0, PLATFORM_LIMITS.x.free.daily - pubs.daily),
            percentage_used: Math.round((pubs.daily / PLATFORM_LIMITS.x.free.daily) * 100),
            reset_at: null,
            source: 'internal'
          });
        }

        // Monthly limit (estimated)
        limits.push({
          type: 'monthly',
          name: 'Tweety (30 dni)',
          limit_max: PLATFORM_LIMITS.x.free.monthly,
          used: pubs.monthly,
          remaining: Math.max(0, PLATFORM_LIMITS.x.free.monthly - pubs.monthly),
          percentage_used: Math.round((pubs.monthly / PLATFORM_LIMITS.x.free.monthly) * 100),
          reset_at: null,
          source: 'estimated'
        });

        platformResults.push({
          platform: 'x',
          account_id: account.id,
          account_name: account.screen_name || account.account_name || 'X Account',
          limits,
          is_limited: limits.some(l => l.remaining === 0),
          total_published_today: pubs.daily,
          total_published_month: pubs.monthly
        });
      }
    }

    // Process Facebook accounts
    if (fbAccounts.data) {
      for (const account of fbAccounts.data) {
        const pubs = pubsByAccount[account.id] || { daily: 0, monthly: 0, quotaUsed: 0 };
        
        platformResults.push({
          platform: 'facebook',
          account_id: account.id,
          account_name: account.page_name || account.account_name || 'Facebook Page',
          limits: [{
            type: 'daily',
            name: 'Posty (24h)',
            limit_max: PLATFORM_LIMITS.facebook.daily,
            used: pubs.daily,
            remaining: Math.max(0, PLATFORM_LIMITS.facebook.daily - pubs.daily),
            percentage_used: Math.round((pubs.daily / PLATFORM_LIMITS.facebook.daily) * 100),
            reset_at: null,
            source: 'internal'
          }],
          is_limited: pubs.daily >= PLATFORM_LIMITS.facebook.daily,
          total_published_today: pubs.daily,
          total_published_month: pubs.monthly
        });
      }
    }

    // Process Instagram accounts
    if (igAccounts.data) {
      for (const account of igAccounts.data) {
        const pubs = pubsByAccount[account.id] || { daily: 0, monthly: 0, quotaUsed: 0 };
        
        platformResults.push({
          platform: 'instagram',
          account_id: account.id,
          account_name: account.instagram_username || account.account_name || 'Instagram Account',
          limits: [{
            type: 'daily',
            name: 'Posty (24h)',
            limit_max: PLATFORM_LIMITS.instagram.daily,
            used: pubs.daily,
            remaining: Math.max(0, PLATFORM_LIMITS.instagram.daily - pubs.daily),
            percentage_used: Math.round((pubs.daily / PLATFORM_LIMITS.instagram.daily) * 100),
            reset_at: null,
            source: 'internal'
          }],
          is_limited: pubs.daily >= PLATFORM_LIMITS.instagram.daily,
          total_published_today: pubs.daily,
          total_published_month: pubs.monthly
        });
      }
    }

    // Process TikTok accounts
    if (ttAccounts.data) {
      for (const account of ttAccounts.data) {
        const pubs = pubsByAccount[account.id] || { daily: 0, monthly: 0, quotaUsed: 0 };
        
        platformResults.push({
          platform: 'tiktok',
          account_id: account.id,
          account_name: account.account_name || 'TikTok Account',
          limits: [{
            type: 'daily',
            name: 'Wideo (24h)',
            limit_max: PLATFORM_LIMITS.tiktok.daily,
            used: pubs.daily,
            remaining: Math.max(0, PLATFORM_LIMITS.tiktok.daily - pubs.daily),
            percentage_used: Math.round((pubs.daily / PLATFORM_LIMITS.tiktok.daily) * 100),
            reset_at: null,
            source: 'internal'
          }],
          is_limited: pubs.daily >= PLATFORM_LIMITS.tiktok.daily,
          total_published_today: pubs.daily,
          total_published_month: pubs.monthly
        });
      }
    }

    // Process YouTube accounts
    if (ytAccounts.data) {
      for (const account of ytAccounts.data) {
        const pubs = pubsByAccount[account.id] || { daily: 0, monthly: 0, quotaUsed: 0 };
        
        platformResults.push({
          platform: 'youtube',
          account_id: account.id,
          account_name: account.channel_title || account.account_name || 'YouTube Channel',
          limits: [
            {
              type: 'daily',
              name: 'Wideo (24h)',
              limit_max: PLATFORM_LIMITS.youtube.daily,
              used: pubs.daily,
              remaining: Math.max(0, PLATFORM_LIMITS.youtube.daily - pubs.daily),
              percentage_used: Math.round((pubs.daily / PLATFORM_LIMITS.youtube.daily) * 100),
              reset_at: null,
              source: 'internal'
            },
            {
              type: 'quota',
              name: 'Quota units',
              limit_max: PLATFORM_LIMITS.youtube.quota,
              used: pubs.quotaUsed * PLATFORM_LIMITS.youtube.upload_cost,
              remaining: Math.max(0, PLATFORM_LIMITS.youtube.quota - (pubs.quotaUsed * PLATFORM_LIMITS.youtube.upload_cost)),
              percentage_used: Math.round((pubs.quotaUsed * PLATFORM_LIMITS.youtube.upload_cost / PLATFORM_LIMITS.youtube.quota) * 100),
              reset_at: null,
              source: 'estimated'
            }
          ],
          is_limited: pubs.daily >= PLATFORM_LIMITS.youtube.daily,
          total_published_today: pubs.daily,
          total_published_month: pubs.monthly
        });
      }
    }

    // Generate summary by platform
    const summaryByPlatform: Record<string, {
      total_accounts: number;
      any_limited: boolean;
      total_published_today: number;
      total_published_month: number;
      total_remaining_today: number;
    }> = {};

    for (const result of platformResults) {
      if (!summaryByPlatform[result.platform]) {
        summaryByPlatform[result.platform] = {
          total_accounts: 0,
          any_limited: false,
          total_published_today: 0,
          total_published_month: 0,
          total_remaining_today: 0
        };
      }
      
      summaryByPlatform[result.platform].total_accounts++;
      if (result.is_limited) summaryByPlatform[result.platform].any_limited = true;
      summaryByPlatform[result.platform].total_published_today += result.total_published_today;
      summaryByPlatform[result.platform].total_published_month += result.total_published_month;
      
      const dailyLimit = result.limits.find(l => l.type === 'daily');
      if (dailyLimit) {
        summaryByPlatform[result.platform].total_remaining_today += dailyLimit.remaining;
      }
    }

    // Overall summary
    const overallSummary = {
      total_accounts: platformResults.length,
      any_limited: platformResults.some(p => p.is_limited),
      total_published_today: platformResults.reduce((sum, p) => sum + p.total_published_today, 0),
      total_published_month: platformResults.reduce((sum, p) => sum + p.total_published_month, 0),
      platforms_count: Object.keys(summaryByPlatform).length
    };

    return new Response(
      JSON.stringify({
        success: true,
        accounts: platformResults,
        summary_by_platform: summaryByPlatform,
        overall_summary: overallSummary,
        platform_limits_config: PLATFORM_LIMITS,
        fetched_at: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-platform-limits:', error);
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
