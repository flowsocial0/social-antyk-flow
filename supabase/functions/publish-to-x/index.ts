import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { createHmac } from "node:crypto";

const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();

// Daily limit for X Free tier (17 tweets per 24 hours)
const X_FREE_TIER_DAILY_LIMIT = 17;
// Monthly limit for X Free tier (estimated ~500/month)
const X_FREE_TIER_MONTHLY_LIMIT = 500;

function validateEnvironmentVariables() {
  if (!API_KEY) throw new Error("Missing TWITTER_CONSUMER_KEY environment variable");
  if (!API_SECRET) throw new Error("Missing TWITTER_CONSUMER_SECRET environment variable");
}

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fix broken URLs in text
function fixUrlsInText(text: string): string {
  if (!text) return text;
  
  let result = text;
  
  // Fix URLs that have spaces/newlines breaking them
  // Pattern: https://domain.com/path with spaces before .html
  result = result.replace(
    /(https?:\/\/[^\s,\n]*?)[\s\n]+([^\s,\n]*?\.(?:html?|php))/gi,
    '$1$2'
  );
  
  // Fix "/ html" or ". html" patterns
  result = result.replace(/([\/\.])\s+(html?|php)\b/gi, '$1$2');
  
  // Fix spaces within URL paths
  result = result.replace(
    /(https?:\/\/[^\s]+?)[\s\n]+([a-zA-Z0-9\-_,]+(?:\.html?)?)/gi,
    (match, urlPart, continuation) => {
      // Only fix if it looks like URL continuation
      if (continuation.match(/^[a-z0-9\-_,]/i) && !continuation.match(/^[A-Z][a-z]/)) {
        return urlPart + continuation;
      }
      return match;
    }
  );
  
  return result;
}

const BASE_URL = "https://api.x.com/2";
const UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";

// Helper function to save rate limit info from X API response headers
async function saveRateLimitInfo(
  supabaseClient: any,
  accountId: string,
  endpoint: string,
  response: Response
): Promise<void> {
  try {
    const limitMax = response.headers.get('x-rate-limit-limit');
    const remaining = response.headers.get('x-rate-limit-remaining');
    const resetTimestamp = response.headers.get('x-rate-limit-reset');

    if (remaining !== null || resetTimestamp !== null) {
      const resetAt = resetTimestamp ? new Date(parseInt(resetTimestamp) * 1000).toISOString() : null;
      
      console.log(`📊 Rate limit for ${endpoint}: ${remaining}/${limitMax}, reset: ${resetAt}`);

      const { error } = await supabaseClient
        .from('x_rate_limits')
        .upsert({
          account_id: accountId,
          endpoint: endpoint,
          limit_max: limitMax ? parseInt(limitMax) : null,
          remaining: remaining ? parseInt(remaining) : null,
          reset_at: resetAt,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'account_id,endpoint'
        });

      if (error) {
        console.error('Failed to save rate limit info:', error);
      } else {
        console.log(`✅ Rate limit info saved for ${endpoint}`);
      }
    }
  } catch (err) {
    console.error('Error saving rate limit info:', err);
  }
}

// Pre-check X API limits before publishing (lightweight GET request to check headers)
async function preCheckXApiLimits(
  userAccessToken: string,
  userAccessTokenSecret: string
): Promise<{ 
  canPublish: boolean; 
  appRemaining: number; 
  userRemaining: number; 
  resetAt: Date | null;
  message?: string;
}> {
  try {
    const url = "https://api.x.com/2/users/me";
    const method = "GET";
    const header = generateOAuthHeader(method, url, userAccessToken, userAccessTokenSecret);
    
    const response = await fetch(url, {
      method,
      headers: { Authorization: header }
    });

    // Parse rate limit headers
    const appRemaining = response.headers.get('x-app-limit-24hour-remaining');
    const userRemaining = response.headers.get('x-user-limit-24hour-remaining');
    const appReset = response.headers.get('x-app-limit-24hour-reset');
    const userReset = response.headers.get('x-user-limit-24hour-reset');

    console.log('📊 X API pre-check headers:', {
      appRemaining, userRemaining, appReset, userReset
    });

    const appRem = appRemaining ? parseInt(appRemaining) : 999;
    const userRem = userRemaining ? parseInt(userRemaining) : 999;
    const effectiveRemaining = Math.min(appRem, userRem);
    
    let resetAt: Date | null = null;
    if (effectiveRemaining === 0) {
      const resetTimestamp = appReset || userReset;
      if (resetTimestamp) {
        resetAt = new Date(parseInt(resetTimestamp) * 1000);
      }
    }

    if (effectiveRemaining === 0) {
      return {
        canPublish: false,
        appRemaining: appRem,
        userRemaining: userRem,
        resetAt,
        message: `X API dzienny limit wyczerpany (pozostało: app=${appRem}, user=${userRem}). Reset: ${resetAt?.toISOString() || 'nieznany'}`
      };
    }

    return {
      canPublish: true,
      appRemaining: appRem,
      userRemaining: userRem,
      resetAt: null
    };
  } catch (error) {
    console.error('Error in X API pre-check:', error);
    // If pre-check fails, allow publishing (fail open)
    return {
      canPublish: true,
      appRemaining: -1,
      userRemaining: -1,
      resetAt: null,
      message: 'Pre-check failed, proceeding with publish attempt'
    };
  }
}

// Check daily publication limit (our own tracking, not API headers)
async function checkDailyPublicationLimit(
  supabaseClient: any,
  accountId: string
): Promise<{ canPublish: boolean; publishedToday: number; resetAt: Date }> {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Count publications in last 24 hours for this account
    const { count, error } = await supabaseClient
      .from('x_daily_publications')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .gte('published_at', twentyFourHoursAgo.toISOString());

    if (error) {
      console.error('Error checking daily publication limit:', error);
      // If we can't check, assume we can publish (fail open)
      return { canPublish: true, publishedToday: 0, resetAt: now };
    }

    const publishedToday = count || 0;
    const canPublish = publishedToday < X_FREE_TIER_DAILY_LIMIT;
    
    // Calculate when the oldest tweet in the window will "expire"
    let resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default: 24h from now
    
    if (!canPublish) {
      // Find the oldest publication in the last 24h to calculate exact reset time
      const { data: oldestPublication } = await supabaseClient
        .from('x_daily_publications')
        .select('published_at')
        .eq('account_id', accountId)
        .gte('published_at', twentyFourHoursAgo.toISOString())
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (oldestPublication?.published_at) {
        // Reset happens 24h after the oldest tweet in the window
        resetAt = new Date(new Date(oldestPublication.published_at).getTime() + 24 * 60 * 60 * 1000);
      }
    }

    console.log(`📊 Daily publication check: ${publishedToday}/${X_FREE_TIER_DAILY_LIMIT} tweets in last 24h. Can publish: ${canPublish}`);
    
    return { canPublish, publishedToday, resetAt };
  } catch (err) {
    console.error('Error in checkDailyPublicationLimit:', err);
    return { canPublish: true, publishedToday: 0, resetAt: new Date() };
  }
}

// Check monthly publication limit
async function checkMonthlyPublicationLimit(
  supabaseClient: any,
  accountId: string
): Promise<{ canPublish: boolean; publishedThisMonth: number; resetAt: Date }> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Count publications in last 30 days for this account
    const { count, error } = await supabaseClient
      .from('x_daily_publications')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .gte('published_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Error checking monthly publication limit:', error);
      return { canPublish: true, publishedThisMonth: 0, resetAt: now };
    }

    const publishedThisMonth = count || 0;
    const canPublish = publishedThisMonth < X_FREE_TIER_MONTHLY_LIMIT;
    
    // Calculate approximate reset (oldest tweet in 30d window)
    let resetAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    if (!canPublish) {
      const { data: oldestPublication } = await supabaseClient
        .from('x_daily_publications')
        .select('published_at')
        .eq('account_id', accountId)
        .gte('published_at', thirtyDaysAgo.toISOString())
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (oldestPublication?.published_at) {
        resetAt = new Date(new Date(oldestPublication.published_at).getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    console.log(`📊 Monthly publication check: ${publishedThisMonth}/${X_FREE_TIER_MONTHLY_LIMIT} tweets in last 30 days. Can publish: ${canPublish}`);
    
    return { canPublish, publishedThisMonth, resetAt };
  } catch (err) {
    console.error('Error in checkMonthlyPublicationLimit:', err);
    return { canPublish: true, publishedThisMonth: 0, resetAt: new Date() };
  }
}

// Save successful publication to our tracking table
async function savePublication(
  supabaseClient: any,
  accountId: string,
  userId: string,
  tweetId: string | null,
  source: string,
  bookId?: string,
  campaignPostId?: string
): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('x_daily_publications')
      .insert({
        account_id: accountId,
        user_id: userId,
        tweet_id: tweetId,
        source: source,
        book_id: bookId || null,
        campaign_post_id: campaignPostId || null
      });

    if (error) {
      console.error('Failed to save publication record:', error);
    } else {
      console.log(`✅ Publication record saved (tweet: ${tweetId}, source: ${source})`);
    }
  } catch (err) {
    console.error('Error saving publication record:', err);
  }
}

// Helper function to check rate limits before publishing (old API-based check)
async function checkRateLimits(
  supabaseClient: any,
  accountId: string
): Promise<{ canPublish: boolean; resetAt: string | null; remaining: number | null }> {
  try {
    const { data, error } = await supabaseClient
      .from('x_rate_limits')
      .select('*')
      .eq('account_id', accountId)
      .eq('endpoint', 'tweets')
      .maybeSingle();

    if (error || !data) {
      // No rate limit data - assume we can publish
      return { canPublish: true, resetAt: null, remaining: null };
    }

    const now = new Date();
    const resetAt = data.reset_at ? new Date(data.reset_at) : null;

    // If remaining is 0 and reset time is in the future, we're rate limited
    if (data.remaining === 0 && resetAt && resetAt > now) {
      console.log(`⚠️ Rate limit exhausted. Reset at: ${resetAt.toISOString()}`);
      return { canPublish: false, resetAt: data.reset_at, remaining: 0 };
    }

    // If reset time has passed, assume limits are refreshed
    if (resetAt && resetAt <= now) {
      console.log('Rate limit period has reset');
      return { canPublish: true, resetAt: null, remaining: null };
    }

    return { canPublish: true, resetAt: data.reset_at, remaining: data.remaining };
  } catch (err) {
    console.error('Error checking rate limits:', err);
    return { canPublish: true, resetAt: null, remaining: null };
  }
}

// Helper to get account ID from token
async function getAccountIdFromToken(supabaseClient: any, userId: string, accountId?: string): Promise<string | null> {
  if (accountId) return accountId;
  
  const { data } = await supabaseClient
    .from('twitter_oauth1_tokens')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();
  
  if (data) return data.id;
  
  const { data: anyToken } = await supabaseClient
    .from('twitter_oauth1_tokens')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  
  return anyToken?.id || null;
}

async function getOAuth1Token(supabaseClient: any, userId: string, accountId?: string): Promise<{ oauth_token: string; oauth_token_secret: string; screen_name?: string; id?: string } | null> {
  // If accountId is provided, fetch that specific account
  if (accountId) {
    const { data, error } = await supabaseClient
      .from('twitter_oauth1_tokens')
      .select('id, oauth_token, oauth_token_secret, screen_name')
      .eq('id', accountId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch OAuth1 token by accountId:', error);
      return null;
    }
    if (data) {
      console.log(`Using specific account: @${data.screen_name} (id: ${accountId})`);
      return data;
    }
  }
  
  // Fallback: try to get default account for user
  const { data: defaultData, error: defaultError } = await supabaseClient
    .from('twitter_oauth1_tokens')
    .select('id, oauth_token, oauth_token_secret, screen_name')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (!defaultError && defaultData) {
    console.log(`Using default account: @${defaultData.screen_name}`);
    return defaultData;
  }

  // Final fallback: get any account for user
  const { data, error } = await supabaseClient
    .from('twitter_oauth1_tokens')
    .select('id, oauth_token, oauth_token_secret, screen_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch OAuth1 token:', error);
    return null;
  }
  return data;
}

async function uploadMedia(
  imageUrl: string | undefined, 
  userAccessToken: string,
  userAccessTokenSecret: string,
  opts?: { arrayBuffer?: ArrayBuffer; contentType?: string }
): Promise<string> {
  console.log("📤 Uploading media with OAuth 1.0a");
  
  const hasBuffer = !!opts?.arrayBuffer;
  let contentType = opts?.contentType || "image/jpeg";
  let imageArrayBuffer: ArrayBuffer;

  if (hasBuffer) {
    imageArrayBuffer = opts!.arrayBuffer!;
    console.log("Using provided image buffer, size:", imageArrayBuffer.byteLength, "bytes, type:", contentType);
  } else {
    if (!imageUrl) throw new Error("No image source provided");
    console.log("Downloading image from:", imageUrl);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    contentType = imageResponse.headers.get("content-type") || contentType;
    imageArrayBuffer = await imageResponse.arrayBuffer();
    console.log("Image downloaded, size:", imageArrayBuffer.byteLength, "bytes, type:", contentType);
  }
  
  // Convert ArrayBuffer to base64 safely
  const uint8Array = new Uint8Array(imageArrayBuffer);
  let binaryString = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const imageBase64 = btoa(binaryString);

  // Try simple upload first
  try {
    const method = "POST";
    const formData = new FormData();
    formData.append("media_data", imageBase64);
    
    const headers: Record<string, string> = {
      Authorization: generateOAuthHeader(method, UPLOAD_URL, userAccessToken, userAccessTokenSecret)
    };
    
    const response = await fetch(UPLOAD_URL, {
      method,
      headers,
      body: formData,
    });
    
    const responseText = await response.text();
    console.log("Media Upload Response Status:", response.status);
    console.log("Media Upload Response Body:", responseText);
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      return result.media_id_string;
    } else {
      console.warn("Simple media upload failed, will try chunked upload");
    }
  } catch (e) {
    console.warn("Simple media upload threw, will try chunked upload:", e);
  }

  // Fallback: Chunked upload
  console.log("📦 Using chunked upload (INIT -> APPEND -> FINALIZE)");
  
  const headers: Record<string, string> = {
    Authorization: generateOAuthHeader("POST", UPLOAD_URL, userAccessToken, userAccessTokenSecret)
  };

  // INIT
  const initForm = new FormData();
  initForm.append("command", "INIT");
  initForm.append("total_bytes", String(imageArrayBuffer.byteLength));
  initForm.append("media_type", contentType);

  const initResp = await fetch(UPLOAD_URL, {
    method: "POST",
    headers,
    body: initForm,
  });
  const initText = await initResp.text();
  console.log("INIT Response Status:", initResp.status);
  console.log("INIT Response Body:", initText);
  if (!initResp.ok) {
    throw new Error(`INIT failed: ${initResp.status}, body: ${initText}`);
  }
  const initJson = JSON.parse(initText);
  const mediaId = initJson.media_id_string;
  if (!mediaId) {
    throw new Error("INIT did not return media_id_string");
  }

  // APPEND
  const appendForm = new FormData();
  appendForm.append("command", "APPEND");
  appendForm.append("media_id", mediaId);
  appendForm.append("segment_index", "0");
  appendForm.append("media", new Blob([imageArrayBuffer], { type: contentType }));

  const appendResp = await fetch(UPLOAD_URL, {
    method: "POST",
    headers,
    body: appendForm,
  });
  const appendText = await appendResp.text();
  console.log("APPEND Response Status:", appendResp.status);
  console.log("APPEND Response Body:", appendText);
  if (!appendResp.ok) {
    throw new Error(`APPEND failed: ${appendResp.status}, body: ${appendText}`);
  }

  // FINALIZE
  const finalizeForm = new FormData();
  finalizeForm.append("command", "FINALIZE");
  finalizeForm.append("media_id", mediaId);

  const finalizeResp = await fetch(UPLOAD_URL, {
    method: "POST",
    headers,
    body: finalizeForm,
  });
  const finalizeText = await finalizeResp.text();
  console.log("FINALIZE Response Status:", finalizeResp.status);
  console.log("FINALIZE Response Body:", finalizeText);
  if (!finalizeResp.ok) {
    throw new Error(`FINALIZE failed: ${finalizeResp.status}, body: ${finalizeText}`);
  }

  return mediaId;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTweetWithRetry(
  tweetText: string,
  userAccessToken: string,
  userAccessTokenSecret: string,
  mediaIds?: string[],
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendTweet(tweetText, userAccessToken, userAccessTokenSecret, mediaIds);
    } catch (error: any) {
      lastError = error;
      
      if (error.message.includes('429')) {
        if (attempt < maxRetries) {
          const waitTime = Math.min(15000 * Math.pow(2, attempt), 60000);
          console.log(`Rate limited (429). Waiting ${waitTime/1000}s before retry ${attempt + 1}/${maxRetries}...`);
          await sleep(waitTime);
          continue;
        } else {
          console.error('Max retries reached for rate limit error');
          const error = new Error(`Twitter rate limit exceeded (429). Please wait a few minutes before trying again.`);
          (error as any).statusCode = 429;
          throw error;
        }
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Failed to send tweet after retries');
}

async function sendTweet(
  tweetText: string,
  userAccessToken: string,
  userAccessTokenSecret: string,
  mediaIds?: string[]
): Promise<{ data: any; response: Response }> {
  const url = `${BASE_URL}/tweets`;
  const method = "POST";

  const body: any = { text: tweetText };
  if (mediaIds && mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }

  console.log("Sending tweet with OAuth 1.0a");
  console.log("Tweet body:", JSON.stringify(body));

  const headers: Record<string, string> = { 
    "Content-Type": "application/json",
    "Authorization": generateOAuthHeader(method, url, userAccessToken, userAccessTokenSecret)
  };

  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log("✅ X API Response:", {
    status: response.status,
    statusText: response.statusText,
    body: responseText,
    rateLimitRemaining: response.headers.get('x-rate-limit-remaining'),
    rateLimitReset: response.headers.get('x-rate-limit-reset')
  });

  if (!response.ok) {
    // 403 Forbidden can mean several things on X (not only app permissions).
    // Always surface the original API message to the user.
    if (response.status === 403) {
      let detail = responseText;
      try {
        const parsed = JSON.parse(responseText);
        detail = parsed?.detail || parsed?.title || responseText;
      } catch {
        // keep raw text
      }

      const error = new Error(
        `Błąd 403 Forbidden z X: ${detail}. ` +
          `Jeśli to błąd uprawnień, sprawdź w Developer Portal X ustawienie aplikacji na "Read and Write" oraz odłącz i połącz konto X ponownie.`
      );
      (error as any).statusCode = 403;
      (error as any).response = response;
      throw error;
    }

    // Check for 429 and provide better error message
    if (response.status === 429) {
      const remaining = response.headers.get('x-rate-limit-remaining');
      const remainingNum = remaining ? parseInt(remaining) : 0;
      
      // If remaining is high but we got 429, it's the daily publication limit
      if (remainingNum > 100) {
        const error = new Error(`Osiągnięto dzienny limit publikacji X (${X_FREE_TIER_DAILY_LIMIT} tweetów/24h dla Free tier). API rate limit OK (${remaining} pozostało), ale dzienny limit wyczerpany. Spróbuj ponownie za kilka godzin lub rozważ upgrade do Basic tier (100 tweetów/dzień).`);
        (error as any).statusCode = 429;
        (error as any).isDailyLimit = true;
        (error as any).response = response;
        throw error;
      }
    }
    
    const error = new Error(`Failed to send tweet: ${response.status}, body: ${responseText}`);
    (error as any).response = response;
    throw error;
  }

  const responseData = JSON.parse(responseText);
  console.log("✅ Tweet published successfully:", {
    tweetId: responseData.data?.id,
    text: responseData.data?.text
  });

  return { data: responseData, response };
}

async function sendTweetWithRateLimitTracking(
  supabaseClient: any,
  accountId: string,
  tweetText: string,
  userAccessToken: string,
  userAccessTokenSecret: string,
  mediaIds?: string[],
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendTweet(tweetText, userAccessToken, userAccessTokenSecret, mediaIds);
      
      // Save rate limit info from successful response
      await saveRateLimitInfo(supabaseClient, accountId, 'tweets', result.response);
      
      return result.data;
    } catch (error: any) {
      lastError = error;
      
      // Save rate limit info even from error responses
      if (error.response) {
        await saveRateLimitInfo(supabaseClient, accountId, 'tweets', error.response);
      }
      
      if (error.message.includes('429')) {
        // Check if this is a daily limit error (not API rate limit)
        if (error.isDailyLimit) {
          console.error('Daily publication limit reached - no retries will help');
          throw error;
        }
        
        if (attempt < maxRetries) {
          const waitTime = Math.min(15000 * Math.pow(2, attempt), 60000);
          console.log(`Rate limited (429). Waiting ${waitTime/1000}s before retry ${attempt + 1}/${maxRetries}...`);
          await sleep(waitTime);
          continue;
        } else {
          console.error('Max retries reached for rate limit error');
          const rateLimitError = new Error(`Twitter rate limit exceeded (429). Please wait a few minutes before trying again.`);
          (rateLimitError as any).statusCode = 429;
          throw rateLimitError;
        }
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Failed to send tweet after retries');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Publish to X Request ===');
    console.log('Method:', req.method);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    let userId: string | null = null;
    
    // Parse request body first to check for userId parameter (from auto-publish)
    let bookId: string | undefined,
        bookIds: string[] | undefined,
        campaignPostId: string | undefined,
        shouldTestConnection: boolean | undefined,
        storageBucket: string | undefined,
        storagePath: string | undefined,
        customText: string | undefined,
        userIdFromBody: string | undefined,
        accountId: string | undefined;
    
    try {
      const body = await req.json();
      bookId = body.bookId;
      bookIds = body.bookIds;
      campaignPostId = body.campaignPostId;
      shouldTestConnection = body.testConnection;
      storageBucket = body.storageBucket;
      storagePath = body.storagePath;
      customText = body.customText;
      userIdFromBody = body.userId;
      accountId = body.accountId;
      console.log('Request body:', { 
        bookId, 
        bookIds: bookIds ? `${bookIds.length} items` : undefined, 
        campaignPostId, 
        testConnection: shouldTestConnection, 
        storageBucket, 
        storagePath,
        userId: userIdFromBody ? 'present' : undefined,
        accountId: accountId ? 'present' : undefined
      });
    } catch (_) {
      console.log('No valid JSON body');
    }

    // Method 1: userId passed directly in body (from auto-publish with service role)
    if (userIdFromBody) {
      userId = userIdFromBody;
      console.log('Using userId from request body:', userId);
    } else {
      // Method 2: Get user_id from Authorization header (direct user call)
      const authHeader = req.headers.get('authorization');
      console.log('Authorization header:', authHeader ? 'present' : 'MISSING');
      
      if (authHeader) {
        // Check if this is a service role call
        const isServiceRole = authHeader.includes(supabaseServiceKey);
        
        if (isServiceRole) {
          console.log('🔧 Service role call detected (from auto-publish-books cron)');
          const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
          const { data: tokenData, error: tokenError } = await serviceSupabase
            .from('twitter_oauth1_tokens')
            .select('user_id')
            .limit(1)
            .maybeSingle();
          
          if (tokenError || !tokenData?.user_id) {
            throw new Error('No X OAuth token found. Please connect your X account first.');
          }
          
          userId = tokenData.user_id;
          console.log('Using user_id from OAuth tokens:', userId);
        } else {
          console.log('👤 User call detected');
          const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
          });

          const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
          if (!userError && user) {
            userId = user.id;
            console.log('User ID from JWT:', userId);
          } else {
            console.log('Failed to get user from JWT:', userError?.message);
          }
        }
      }
    }

    if (!userId) {
      throw new Error('No user ID available. Please provide userId in request body or valid authorization header.');
    }

    console.log('Final User ID:', userId);
    
    validateEnvironmentVariables();
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch user's OAuth 1.0a tokens (using specific accountId if provided)
    const oauth1Token = await getOAuth1Token(supabaseClient, userId, accountId);
    console.log('OAuth1 token for user:', oauth1Token ? `found (@${oauth1Token.screen_name})` : 'not found');
    
    if (!oauth1Token) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No X account connected. Please connect your X account first.',
          requiresConnection: true
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // === Pre-check X API limits before any publish attempt (skip for test connection) ===
    if (!shouldTestConnection) {
      console.log('🔍 Pre-checking X API limits...');
      const apiPreCheck = await preCheckXApiLimits(
        oauth1Token.oauth_token, 
        oauth1Token.oauth_token_secret
      );

      if (!apiPreCheck.canPublish) {
        console.log(`⚠️ X API pre-check failed: ${apiPreCheck.message}`);
        
        // If this is a campaign post, update its status
        if (campaignPostId) {
          await supabaseClient
            .from('campaign_posts')
            .update({ 
              status: 'rate_limited',
              error_code: 'X_API_DAILY_LIMIT',
              error_message: apiPreCheck.message,
              next_retry_at: apiPreCheck.resetAt?.toISOString()
            })
            .eq('id', campaignPostId);
        }
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'daily_limit',
            errorCode: 'X_API_DAILY_LIMIT',
            app_remaining: apiPreCheck.appRemaining,
            user_remaining: apiPreCheck.userRemaining,
            reset_at: apiPreCheck.resetAt?.toISOString(),
            message: apiPreCheck.message
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      console.log(`✅ X API pre-check passed: app=${apiPreCheck.appRemaining}, user=${apiPreCheck.userRemaining}`);
    }
    
    // Test connection endpoint
    if (shouldTestConnection) {
      console.log("Testing Twitter API connection with OAuth 1.0a...");
      
      try {
        const testUrl = "https://api.twitter.com/1.1/account/verify_credentials.json";
        const testMethod = "GET";
        const testHeader = generateOAuthHeader(testMethod, testUrl, oauth1Token.oauth_token, oauth1Token.oauth_token_secret);
        
        const testResponse = await fetch(testUrl, {
          method: testMethod,
          headers: { Authorization: testHeader }
        });
        
        const testText = await testResponse.text();
        console.log("Test response:", testResponse.status, testText);
        
        if (testResponse.ok) {
          const userData = JSON.parse(testText);
          return new Response(
            JSON.stringify({
              success: true,
              connected: true,
              username: userData.screen_name,
              name: userData.name
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Connection test failed: ${testResponse.status}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log("Received request:", { bookId, bookIds, campaignPostId });

    // Get account ID for daily limit tracking
    const xAccountId = oauth1Token.id || await getAccountIdFromToken(supabaseClient, userId, accountId);

    // Handle campaign post
    if (campaignPostId) {
      try {
        // Check daily publication limit FIRST (our own tracking)
        if (xAccountId) {
          const dailyLimitCheck = await checkDailyPublicationLimit(supabaseClient, xAccountId);
          if (!dailyLimitCheck.canPublish) {
            console.log(`⚠️ Daily publication limit reached (${dailyLimitCheck.publishedToday}/${X_FREE_TIER_DAILY_LIMIT}). Reset at: ${dailyLimitCheck.resetAt.toISOString()}`);
            
            // Update campaign post with daily limit info
            await supabaseClient
              .from('campaign_posts')
              .update({ 
                status: 'rate_limited',
                error_code: 'DAILY_LIMIT',
                error_message: `Dzienny limit publikacji X wyczerpany (${dailyLimitCheck.publishedToday}/${X_FREE_TIER_DAILY_LIMIT} tweetów). Automatyczne ponowienie po resecie.`,
                next_retry_at: dailyLimitCheck.resetAt.toISOString()
              })
              .eq('id', campaignPostId);
            
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'daily_limit',
                published_today: dailyLimitCheck.publishedToday,
                daily_limit: X_FREE_TIER_DAILY_LIMIT,
                reset_at: dailyLimitCheck.resetAt.toISOString(),
                message: `Dzienny limit publikacji X wyczerpany (${dailyLimitCheck.publishedToday}/${X_FREE_TIER_DAILY_LIMIT}). Free tier pozwala na ${X_FREE_TIER_DAILY_LIMIT} tweetów/24h. Publikacja zostanie wznowiona automatycznie.`
              }),
              { 
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }

        // Also check API rate limits (existing check)
        if (xAccountId) {
          const rateLimitCheck = await checkRateLimits(supabaseClient, xAccountId);
          if (!rateLimitCheck.canPublish) {
            console.log(`⚠️ API Rate limit check failed - cannot publish. Reset at: ${rateLimitCheck.resetAt}`);
            
            // Update campaign post with rate limit info
            await supabaseClient
              .from('campaign_posts')
              .update({ 
                status: 'rate_limited',
                error_code: '429',
                error_message: `Limit API X wyczerpany. Automatyczne ponowienie po resecie.`,
                next_retry_at: rateLimitCheck.resetAt
              })
              .eq('id', campaignPostId);
            
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'rate_limit',
                reset_at: rateLimitCheck.resetAt,
                message: 'Limit API X wyczerpany. Publikacja zostanie wznowiona automatycznie po resecie.'
              }),
              { 
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }

        const { data: campaignPost, error: postError } = await supabaseClient
          .from('campaign_posts')
          .select(`
            *,
            book:books(*)
          `)
          .eq('id', campaignPostId)
          .single();

        if (postError) throw postError;
        if (!campaignPost) throw new Error(`Campaign post not found: ${campaignPostId}`);

        // For multi-account publishing, we skip the status check if accountId is provided
        // because one post can be published to multiple accounts
        if (campaignPost.status === 'published' && !accountId) {
          console.log(`Campaign post ${campaignPostId} already published and no specific account requested, skipping`);
          return new Response(
            JSON.stringify({ success: false, error: "Already published" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Log if we're republishing to a different account
        if (campaignPost.status === 'published' && accountId) {
          console.log(`Campaign post ${campaignPostId} already published, but publishing to additional account ${accountId}`);
        }

        // Fetch user's AI suffix and default website URL from user_settings
        let aiSuffix = '(ai)'; // Default
        let defaultWebsiteUrl = '';
        const { data: userSettings } = await supabaseClient
          .from('user_settings')
          .select('ai_suffix_x, default_website_url')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (userSettings?.ai_suffix_x !== null && userSettings?.ai_suffix_x !== undefined) {
          aiSuffix = userSettings.ai_suffix_x;
        }
        if (userSettings?.default_website_url) {
          defaultWebsiteUrl = userSettings.default_website_url;
        }
        console.log(`Using AI suffix for X: "${aiSuffix}", default URL: "${defaultWebsiteUrl}"`);

        // Determine the link to use: book's product_url has priority, fallback to default_website_url
        const linkToUse = campaignPost.book?.product_url || defaultWebsiteUrl || '';
        const linkPart = linkToUse ? `\n${linkToUse}` : '';
        const suffixPart = aiSuffix ? `\n\n${aiSuffix}` : '';
        
        // Add link and suffix to the campaign post text
        let tweetText = (fixUrlsInText(campaignPost.text) + linkPart + suffixPart).trim();

        let mediaIds: string[] = [];
        if (campaignPost.book?.image_url || campaignPost.book?.storage_path) {
          try {
            if (campaignPost.book.storage_path) {
              console.log(`📤 Uploading media from storage_path: ${campaignPost.book.storage_path}`);
              const { data: storageBlob, error: storageError } = await supabaseClient.storage
                .from('ObrazkiKsiazek')
                .download(campaignPost.book.storage_path);
              
              if (storageError) {
                console.error("❌ Storage download error:", storageError);
                throw new Error(`Failed to download from storage: ${storageError.message}`);
              }
              
              const arrayBuffer = await storageBlob.arrayBuffer();
              console.log(`✅ Downloaded ${arrayBuffer.byteLength} bytes from storage`);
              
              const inferType = (p: string) => {
                const ext = p.split('.').pop()?.toLowerCase();
                switch (ext) {
                  case 'png': return 'image/png';
                  case 'webp': return 'image/webp';
                  case 'gif': return 'image/gif';
                  case 'jpg':
                  case 'jpeg':
                  default: return 'image/jpeg';
                }
              };
              const contentType = storageBlob.type || inferType(campaignPost.book.storage_path);
              console.log(`📸 Uploading to X.com with content type: ${contentType}`);
              
              const mediaId = await uploadMedia(undefined, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, { arrayBuffer, contentType });
              mediaIds = [mediaId];
              console.log("✅ Media uploaded successfully from storage_path, media_id:", mediaId);
            } else if (campaignPost.book.image_url) {
              console.log(`📤 Uploading media from image_url: ${campaignPost.book.image_url}`);
              const mediaId = await uploadMedia(campaignPost.book.image_url, oauth1Token.oauth_token, oauth1Token.oauth_token_secret);
              mediaIds = [mediaId];
              console.log("✅ Media uploaded successfully from image_url, media_id:", mediaId);
            }
          } catch (error: any) {
            console.error("❌ Media upload failed:", error);
            console.error("Error details:", {
              message: error.message,
              stack: error.stack,
              storage_path: campaignPost.book?.storage_path,
              image_url: campaignPost.book?.image_url
            });
            
            if (campaignPost.type === 'sales') {
              throw new Error(`Sales post requires image but upload failed: ${error.message}`);
            }
          }
        } else if (campaignPost.type === 'sales') {
          throw new Error('Sales post missing book image (no storage_path or image_url)');
        }

        console.log(`🐦 Sending tweet with ${mediaIds.length} media attachments`);

        // Use the new rate limit tracking version
        const xAccountIdForTracking = oauth1Token.id || xAccountId;
        const tweetResponse = xAccountIdForTracking 
          ? await sendTweetWithRateLimitTracking(supabaseClient, xAccountIdForTracking, tweetText, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, mediaIds)
          : await sendTweetWithRetry(tweetText, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, mediaIds);
        console.log("Tweet sent successfully:", tweetResponse);

        // SAVE PUBLICATION RECORD for daily limit tracking
        if (xAccountIdForTracking && tweetResponse?.data?.id) {
          await savePublication(
            supabaseClient,
            xAccountIdForTracking,
            userId,
            tweetResponse.data.id,
            'campaign',
            campaignPost.book_id,
            campaignPostId
          );
        }

        // Only update status to published if no specific accountId was provided
        // When accountId is provided, auto-publish-books will handle the final status update
        // after all accounts have been processed
        if (!accountId) {
          const { error: updateError } = await supabaseClient
            .from('campaign_posts')
            .update({ 
              status: 'published',
              published_at: new Date().toISOString()
            })
            .eq('id', campaignPostId);

          if (updateError) throw updateError;
        } else {
          console.log(`Skipping status update for campaign post ${campaignPostId} - auto-publish-books will handle it`);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            tweetId: tweetResponse.data?.id 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error: any) {
        console.error(`Error publishing campaign post ${campaignPostId}:`, error);
        
        const isRateLimitError = error.statusCode === 429 || 
          error.message?.includes('429') || 
          error.message?.includes('Too Many Requests') ||
          error.message?.includes('rate limit') ||
          error.isDailyLimit;
        
        if (isRateLimitError) {
          const { data: currentPost } = await supabaseClient
            .from('campaign_posts')
            .select('retry_count')
            .eq('id', campaignPostId)
            .single();
          
          const retryCount = (currentPost?.retry_count || 0) + 1;
          
          // For daily limit, use longer delays
          const isDailyLimit = error.isDailyLimit || error.message?.includes('dzienny limit');
          const retryDelays = isDailyLimit ? [60, 120, 240] : [15, 30, 60];
          const delayMinutes = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];
          const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
          
          const errorMessage = isDailyLimit 
            ? `Dzienny limit publikacji X wyczerpany (${X_FREE_TIER_DAILY_LIMIT} tweetów/24h). Automatyczne ponowienie za ${delayMinutes} minut.`
            : `Rate limit osiągnięty. Automatyczne ponowienie za ${delayMinutes} minut.`;
          
          const { error: rateLimitUpdateError } = await supabaseClient
            .from('campaign_posts')
            .update({ 
              status: 'rate_limited',
              error_code: isDailyLimit ? 'DAILY_LIMIT' : '429',
              error_message: errorMessage,
              retry_count: retryCount,
              next_retry_at: nextRetryAt
            })
            .eq('id', campaignPostId);
          
          if (rateLimitUpdateError) {
            console.error(`Failed to update campaign post with rate limit info:`, rateLimitUpdateError);
          } else {
            console.log(`✅ Rate limit info saved. Retry ${retryCount} scheduled for: ${nextRetryAt}`);
          }
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: errorMessage,
              errorCode: isDailyLimit ? 'X_DAILY_LIMIT' : 'X_RATE_LIMIT',
              retry_count: retryCount,
              next_retry_at: nextRetryAt,
              message: errorMessage
            }),
            { 
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        } else {
          // Check for 403 Forbidden - permissions issue
          const isForbiddenError = error.statusCode === 403 || 
            error.message?.includes('403') || 
            error.message?.includes('Forbidden');
          
          let userFriendlyError = error.message;
          if (isForbiddenError) {
            userFriendlyError = 'Błąd 403: Brak uprawnień do publikowania. Sprawdź w Developer Portal X, czy aplikacja ma uprawnienia "Read and Write", a następnie połącz konto ponownie.';
          }
          
          await supabaseClient
            .from('campaign_posts')
            .update({ 
              status: 'failed',
              error_code: isForbiddenError ? '403' : 'unknown',
              error_message: userFriendlyError
            })
            .eq('id', campaignPostId);
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: userFriendlyError 
            }),
            { 
              status: isForbiddenError ? 403 : 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      }
    }

    // Handle single or multiple books
    const idsToPublish = bookId ? [bookId] : bookIds;
    if (!idsToPublish || idsToPublish.length === 0) {
      throw new Error("No book IDs provided");
    }

    const results = [];
    
    for (const id of idsToPublish) {
      try {
        // Check daily publication limit before each book
        if (xAccountId) {
          const dailyLimitCheck = await checkDailyPublicationLimit(supabaseClient, xAccountId);
          if (!dailyLimitCheck.canPublish) {
            console.log(`⚠️ Daily publication limit reached for book ${id}`);
            results.push({
              bookId: id,
              success: false,
              error: `Dzienny limit publikacji X wyczerpany (${dailyLimitCheck.publishedToday}/${X_FREE_TIER_DAILY_LIMIT}). Spróbuj ponownie za kilka godzin.`
            });
            continue;
          }
        }

        const { data: book, error: bookError } = await supabaseClient
          .from('books')
          .select('*')
          .eq('id', id)
          .single();

        if (bookError) throw bookError;
        if (!book) throw new Error(`Book not found: ${id}`);

        const { data: platformContent } = await supabaseClient
          .from('book_platform_content')
          .select('*')
          .eq('book_id', id)
          .eq('platform', 'x')
          .maybeSingle();

        // Fetch user's AI suffix and default website URL from user_settings
        let aiSuffix = '(ai)'; // Default
        let defaultWebsiteUrl = '';
        const { data: userSettings } = await supabaseClient
          .from('user_settings')
          .select('ai_suffix_x, default_website_url')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (userSettings?.ai_suffix_x !== null && userSettings?.ai_suffix_x !== undefined) {
          aiSuffix = userSettings.ai_suffix_x;
        }
        if (userSettings?.default_website_url) {
          defaultWebsiteUrl = userSettings.default_website_url;
        }
        console.log(`Using AI suffix for X: "${aiSuffix}", default URL: "${defaultWebsiteUrl}"`);

        // Determine the link to use: book's product_url has priority, fallback to default_website_url
        const linkToUse = book.product_url || defaultWebsiteUrl || '';
        const linkPart = linkToUse ? `\n${linkToUse}` : '';
        const suffixPart = aiSuffix ? `\n\n${aiSuffix}` : '';
        
        // Get the base text (without link and suffix)
        let baseText = customText 
          ? fixUrlsInText(customText)
          : platformContent?.custom_text
            ? fixUrlsInText(platformContent.custom_text)
            : platformContent?.ai_generated_text
              ? fixUrlsInText(platformContent.ai_generated_text)
              : book.ai_text_x
                ? fixUrlsInText(book.ai_text_x)
                : book.ai_generated_text
                  ? fixUrlsInText(book.ai_generated_text)
                  : `📚 ${book.title}${book.author ? ` - ${book.author}` : ''}`;
        
        // Always add link and suffix to the text
        let tweetText = (baseText + linkPart + suffixPart).trim();

        let mediaIds: string[] = [];
        if (book.storage_path || book.image_url) {
          try {
            if (book.storage_path) {
              console.log(`📤 Uploading media from book storage_path: ${book.storage_path}`);
              const { data: storageBlob, error: storageError } = await supabaseClient.storage
                .from('ObrazkiKsiazek')
                .download(book.storage_path);
              
              if (storageError) {
                console.error("❌ Storage download error:", storageError);
                throw new Error(`Failed to download from storage: ${storageError.message}`);
              }
              
              const arrayBuffer = await storageBlob.arrayBuffer();
              console.log(`✅ Downloaded ${arrayBuffer.byteLength} bytes from storage`);
              
              const inferType = (p: string) => {
                const ext = p.split('.').pop()?.toLowerCase();
                switch (ext) {
                  case 'png': return 'image/png';
                  case 'webp': return 'image/webp';
                  case 'gif': return 'image/gif';
                  case 'jpg':
                  case 'jpeg':
                  default: return 'image/jpeg';
                }
              };
              const contentType = storageBlob.type || inferType(book.storage_path);
              console.log(`📸 Uploading to X.com with content type: ${contentType}`);
              
              const mediaId = await uploadMedia(undefined, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, { arrayBuffer, contentType });
              mediaIds = [mediaId];
              console.log("✅ Media uploaded successfully, media_id:", mediaId);
            } else if (book.image_url) {
              console.log(`📤 Uploading media from book image_url: ${book.image_url}`);
              const mediaId = await uploadMedia(book.image_url, oauth1Token.oauth_token, oauth1Token.oauth_token_secret);
              mediaIds = [mediaId];
              console.log("✅ Media uploaded successfully, media_id:", mediaId);
            }
          } catch (error: any) {
            console.error("❌ Media upload failed:", error);
          }
        }

        console.log(`🐦 Sending tweet for book ${id} with ${mediaIds.length} media attachments`);

        const xAccountIdForTracking = oauth1Token.id || xAccountId;
        const tweetResponse = xAccountIdForTracking
          ? await sendTweetWithRateLimitTracking(supabaseClient, xAccountIdForTracking, tweetText, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, mediaIds)
          : await sendTweetWithRetry(tweetText, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, mediaIds);
        console.log("Tweet sent successfully for book:", id, tweetResponse);

        // SAVE PUBLICATION RECORD for daily limit tracking
        if (xAccountIdForTracking && tweetResponse?.data?.id) {
          await savePublication(
            supabaseClient,
            xAccountIdForTracking,
            userId,
            tweetResponse.data.id,
            'book',
            id,
            undefined
          );
        }

        // Update book_platform_content
        if (platformContent) {
          await supabaseClient
            .from('book_platform_content')
            .update({ 
              published: true,
              published_at: new Date().toISOString(),
              post_id: tweetResponse.data?.id
            })
            .eq('id', platformContent.id);
        } else {
          await supabaseClient
            .from('book_platform_content')
            .insert({
              book_id: id,
              platform: 'x',
              user_id: userId,
              published: true,
              published_at: new Date().toISOString(),
              post_id: tweetResponse.data?.id
            });
        }

        results.push({
          bookId: id,
          success: true,
          tweetId: tweetResponse.data?.id
        });

      } catch (error: any) {
        console.error(`Error publishing book ${id}:`, error);
        
        const isDailyLimit = error.isDailyLimit || error.message?.includes('dzienny limit');
        
        results.push({
          bookId: id,
          success: false,
          error: error.message,
          isDailyLimit
        });
      }
    }

    const allSucceeded = results.every(r => r.success);
    const anySucceeded = results.some(r => r.success);

    // Check if any result has daily limit error
    const dailyLimitResult = results.find(r => r.isDailyLimit);
    const failedResults = results.filter(r => !r.success);
    const errorMessage = allSucceeded 
      ? `Successfully published ${results.length} book(s)` 
      : anySucceeded
        ? `Częściowo opublikowano: ${results.filter(r => r.success).length}/${results.length} udanych`
        : dailyLimitResult
          ? failedResults[0]?.error || 'Dzienny limit publikacji wyczerpany'
          : failedResults[0]?.error || 'Wszystkie publikacje zakończyły się błędem';

    return new Response(
      JSON.stringify({ 
        success: anySucceeded,
        results,
        error: anySucceeded ? undefined : errorMessage,
        errorCode: dailyLimitResult ? 'X_DAILY_LIMIT' : undefined,
        message: errorMessage
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in publish-to-x:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});