import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { createHmac } from "node:crypto";

const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();

function validateEnvironmentVariables() {
  if (!API_KEY) throw new Error("Missing TWITTER_CONSUMER_KEY environment variable");
  if (!API_SECRET) throw new Error("Missing TWITTER_CONSUMER_SECRET environment variable");
  if (!ACCESS_TOKEN) throw new Error("Missing TWITTER_ACCESS_TOKEN environment variable");
  if (!ACCESS_TOKEN_SECRET) throw new Error("Missing TWITTER_ACCESS_TOKEN_SECRET environment variable");
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // Sort parameters alphabetically by key
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

function generateOAuthHeader(method: string, url: string): string {
  const oauthParams = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    API_SECRET!,
    ACCESS_TOKEN_SECRET!
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

const BASE_URL = "https://api.x.com/2";
const UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";

async function getLatestOAuth2AccessToken(supabaseClient: any, userId: string): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from('twitter_oauth_tokens')
    .select('access_token, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch OAuth2 token:', error);
    return null;
  }
  return data ? data.access_token : null;
}

async function testConnectionWithOAuth2(bearerToken: string): Promise<any> {
  const url = `${BASE_URL}/users/me`;
  const method = "GET";

  console.log("=== Testing Twitter OAuth 2.0 Connection ===");

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
  });

  const responseText = await response.text();
  console.log("Test Connection - Response Status:", response.status);
  console.log("Test Connection - Response Body:", responseText);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
  }

  return JSON.parse(responseText);
}

// Verify OAuth 1.0a credentials by calling v1.1 endpoint
async function verifyOAuth1(): Promise<{ ok: boolean; user?: any; status?: number; body?: string; error?: string }> {
  const url = "https://api.twitter.com/1.1/account/verify_credentials.json";
  const method = "GET";
  const oauthHeader = generateOAuthHeader(method, url);
  console.log("=== Testing Twitter OAuth 1.0a Connection ===");
  const response = await fetch(url, {
    method,
    headers: { Authorization: oauthHeader }
  });
  const responseText = await response.text();
  console.log("OAuth1 Verify - Status:", response.status);
  console.log("OAuth1 Verify - Body:", responseText);
  if (!response.ok) {
    return { ok: false, status: response.status, body: responseText };
  }
  try {
    return { ok: true, user: JSON.parse(responseText) };
  } catch (_e) {
    return { ok: true };
  }
}

async function uploadMedia(imageUrl?: string, opts?: { arrayBuffer?: ArrayBuffer; contentType?: string; oauth2Token?: string }): Promise<string> {
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
  
  // Convert ArrayBuffer to base64 safely without stack overflow
  const uint8Array = new Uint8Array(imageArrayBuffer);
  let binaryString = '';
  const chunkSize = 8192; // Process in chunks to avoid stack overflow
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const imageBase64 = btoa(binaryString);

  // First try simple upload with media_data
  try {
    const method = "POST";
    const formData = new FormData();
    formData.append("media_data", imageBase64);
    
    // Use OAuth2 Bearer token if provided (user's account), otherwise OAuth 1.0a (fixed account)
    const headers: Record<string, string> = {};
    if (opts?.oauth2Token) {
      headers.Authorization = `Bearer ${opts.oauth2Token}`;
      console.log("📤 Uploading media with user's OAuth2 token (from connected account)");
    } else {
      headers.Authorization = generateOAuthHeader(method, UPLOAD_URL);
      console.log("📤 Uploading media with OAuth 1.0a (fixed account - fallback)");
    }
    
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

  // Fallback: Chunked upload (INIT -> APPEND -> FINALIZE)
  console.log("📦 Using chunked upload (INIT -> APPEND -> FINALIZE)");
  
  // Use OAuth2 Bearer token if provided, otherwise OAuth 1.0a
  const headers: Record<string, string> = {};
  if (opts?.oauth2Token) {
    headers.Authorization = `Bearer ${opts.oauth2Token}`;
    console.log("📤 Chunked upload with user's OAuth2 token");
  } else {
    headers.Authorization = generateOAuthHeader("POST", UPLOAD_URL);
    console.log("📤 Chunked upload with OAuth 1.0a (fallback)");
  }

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

  // APPEND (single chunk)
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
  mediaIds?: string[], 
  oauth2Token?: string,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendTweet(tweetText, mediaIds, oauth2Token);
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      if (error.message.includes('429')) {
        if (attempt < maxRetries) {
          // Exponential backoff: 15s, 30s, 60s
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
      
      // For other errors, don't retry
      throw error;
    }
  }
  
  throw lastError || new Error('Failed to send tweet after retries');
}

async function sendTweet(tweetText: string, mediaIds?: string[], oauth2Token?: string): Promise<any> {
  const url = `${BASE_URL}/tweets`;
  const method = "POST";

  const body: any = { text: tweetText };
  if (mediaIds && mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }

  // Use OAuth2 user token (posts from the connected user's account)
  if (!oauth2Token) {
    throw new Error('No OAuth2 token provided - user must connect their X account');
  }

  console.log("Sending tweet with user's OAuth2 token (will post from connected account)");
  console.log("Tweet body:", JSON.stringify(body));

  const headers: Record<string, string> = { 
    "Content-Type": "application/json",
    "Authorization": `Bearer ${oauth2Token}`
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
    body: responseText
  });

  if (!response.ok) {
    throw new Error(`Failed to send tweet: ${response.status}, body: ${responseText}`);
  }

  const responseData = JSON.parse(responseText);
  console.log("✅ Tweet published successfully from user's account:", {
    tweetId: responseData.data?.id,
    text: responseData.data?.text
  });

  return responseData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Publish to X Request ===');
    console.log('Method:', req.method);
    
    // Get user_id from Authorization header
    const authHeader = req.headers.get('authorization');
    console.log('Authorization header:', authHeader ? 'present' : 'MISSING');
    
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with user token to get user_id
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      console.error('Failed to get user from token:', userError);
      throw new Error('Failed to get user from token');
    }

    const userId = user.id;
    console.log('User ID:', userId);
    
    validateEnvironmentVariables();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookId, bookIds, campaignPostId, testConnection: shouldTestConnection, storageBucket, storagePath, customText } = await req.json();
    console.log('Request body:', { bookId, bookIds: bookIds ? `${bookIds.length} items` : undefined, campaignPostId, testConnection: shouldTestConnection, storageBucket, storagePath });
    
    // Fetch latest OAuth2 token for this user
    const oauth2Token = await getLatestOAuth2AccessToken(supabaseClient, userId);
    console.log('OAuth2 token for user:', oauth2Token ? 'found' : 'not found');
    
    // Require OAuth2 token - user must connect their X account
    if (!oauth2Token) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No X account connected. Please connect your X account first in Social Accounts settings.',
          requiresConnection: true
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Test connection endpoint
    if (shouldTestConnection) {
      console.log("Testing Twitter API connection (OAuth1 and OAuth2)...");

      // OAuth1 test (does not require OAuth2 token)
      const oauth1 = await verifyOAuth1();

      // OAuth2 test (optional)
      let oauth2: any = { ok: false, error: 'Brak ważnego tokenu OAuth2' };
      if (oauth2Token) {
        try {
          const result = await testConnectionWithOAuth2(oauth2Token);
          oauth2 = { ok: true, user: result.data ?? result };
        } catch (e: any) {
          oauth2 = { ok: false, error: e.message };
        }
      }

      return new Response(
        JSON.stringify({
          success: oauth1.ok || oauth2.ok,
          oauth1,
          oauth2,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log("Received request:", { bookId, bookIds, campaignPostId });

    // Handle campaign post
    if (campaignPostId) {
      try {
        // Get campaign post details
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

        // Check if already published
        if (campaignPost.status === 'published') {
          console.log(`Campaign post ${campaignPostId} already published, skipping`);
          return new Response(
            JSON.stringify({ success: false, error: "Already published" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Format tweet text - text already contains URL for sales posts from campaign generation
        let tweetText = campaignPost.text + '\n\n(ai)';

        // Upload media if book has an image (REQUIRED for sales posts)
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
              
              // Pass arrayBuffer, contentType, and oauth2Token as options object
              const mediaId = await uploadMedia(undefined, { arrayBuffer, contentType, oauth2Token });
              mediaIds = [mediaId];
              console.log("✅ Media uploaded successfully from storage_path, media_id:", mediaId);
            } else if (campaignPost.book.image_url) {
              console.log(`📤 Uploading media from image_url: ${campaignPost.book.image_url}`);
              const mediaId = await uploadMedia(campaignPost.book.image_url, { oauth2Token });
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
            
            // For sales posts, media is REQUIRED - don't publish without it
            if (campaignPost.type === 'sales') {
              throw new Error(`Sales post requires image but upload failed: ${error.message}`);
            }
          }
        } else if (campaignPost.type === 'sales') {
          // Sales posts MUST have an image
          throw new Error('Sales post missing book image (no storage_path or image_url)');
        }

        console.log(`🐦 Sending tweet with ${mediaIds.length} media attachments`);

        // Send tweet using user's OAuth2 token
        const tweetResponse = await sendTweetWithRetry(tweetText, mediaIds, oauth2Token);
        console.log("Tweet sent successfully:", tweetResponse);

        // Update campaign post as published
        const { error: updateError } = await supabaseClient
          .from('campaign_posts')
          .update({ 
            status: 'published',
            published_at: new Date().toISOString()
          })
          .eq('id', campaignPostId);

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ 
            success: true, 
            tweetId: tweetResponse.data?.id 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error: any) {
        console.error(`Error publishing campaign post ${campaignPostId}:`, error);
        
        // Check if it's a rate limit error (429)
        const isRateLimitError = error.statusCode === 429 || 
          error.message?.includes('429') || 
          error.message?.includes('Too Many Requests') ||
          error.message?.includes('rate limit');
        
        if (isRateLimitError) {
          // Get current retry count
          const { data: currentPost } = await supabaseClient
            .from('campaign_posts')
            .select('retry_count')
            .eq('id', campaignPostId)
            .single();
          
          const retryCount = (currentPost?.retry_count || 0) + 1;
          
          // Calculate next retry time: 15, 30, 60 minutes
          const retryDelays = [15, 30, 60];
          const delayMinutes = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];
          const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
          
          // Update with rate limit info
          const { error: rateLimitUpdateError } = await supabaseClient
            .from('campaign_posts')
            .update({ 
              status: 'rate_limited',
              error_code: '429',
              error_message: `Rate limit osiągnięty. Automatyczne ponowienie za ${delayMinutes} minut.`,
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
              error: 'rate_limit',
              retry_count: retryCount,
              next_retry_at: nextRetryAt,
              message: `Rate limit osiągnięty. Automatyczne ponowienie za ${delayMinutes} minut.`
            }),
            { 
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        } else {
          // Mark post as failed for other errors
          await supabaseClient
            .from('campaign_posts')
            .update({ 
              status: 'failed',
              error_code: 'unknown',
              error_message: error.message
            })
            .eq('id', campaignPostId);
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: error.message 
            }),
            { 
              status: 500,
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
        // Get book details
        const { data: book, error: bookError } = await supabaseClient
          .from('books')
          .select('*')
          .eq('id', id)
          .single();

        if (bookError) throw bookError;
        if (!book) throw new Error(`Book not found: ${id}`);

        // Check if already published on THIS platform (X)
        const { data: platformContent } = await supabaseClient
          .from('book_platform_content')
          .select('*')
          .eq('book_id', id)
          .eq('platform', 'x')
          .maybeSingle();

        if (platformContent?.published) {
          console.log(`Book ${id} already published on X, skipping`);
          results.push({ id, success: false, error: "Already published on this platform" });
          continue;
        }

        // Format tweet using AI-generated text from database, or fall back to visual template
        let tweetText;
        if (book.ai_generated_text) {
          // Use AI-generated text from database
          tweetText = `${book.ai_generated_text}\n\n${book.product_url}\n\n(ai)`;
          console.log("Using AI-generated text from database");
        } else if (customText) {
          // Fallback to custom text parameter (for backwards compatibility)
          tweetText = `${customText}\n\n(ai)`;
          console.log("Using custom text parameter");
        } else {
          // Use default visual template
          tweetText = `✨ LIMITOWANA OFERTA ✨\n\n📚 ${book.title}\n\n`;
          
          if (book.sale_price) {
            tweetText += `💰 Tylko ${book.sale_price} zł\n\n`;
          }
          
          // Add truncated description if available
          if (book.description) {
            const maxDescLength = 120;
            const truncatedDesc = book.description.length > maxDescLength 
              ? book.description.substring(0, maxDescLength).trim() + '...'
              : book.description;
            tweetText += `${truncatedDesc}\n\n`;
          }
          
          tweetText += `🔥 Kup teraz:\n👉 ${book.product_url}\n\n(ai)`;
        }

        console.log("Tweet to send:", tweetText);

        // Upload media: prefer storage_path, then Supabase Storage override, then image_url
        let mediaIds: string[] | undefined = undefined;
        try {
          if (book.storage_path) {
            console.log("Uploading media from book.storage_path...", { storage_path: book.storage_path });
            const { data: storageBlob, error: storageError } = await supabaseClient.storage
              .from('ObrazkiKsiazek')
              .download(book.storage_path);
            if (storageError) throw storageError;
            const arrayBuffer = await storageBlob.arrayBuffer();
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
            const mediaId = await uploadMedia(undefined, { arrayBuffer, contentType, oauth2Token });
            mediaIds = [mediaId];
            console.log("Media uploaded successfully from book.storage_path, media_id:", mediaId);
          } else if (storageBucket && storagePath) {
            console.log("Uploading media from Supabase Storage override...", { storageBucket, storagePath });
            const { data: storageBlob, error: storageError } = await supabaseClient.storage
              .from(storageBucket)
              .download(storagePath);
            if (storageError) throw storageError;
            const arrayBuffer = await storageBlob.arrayBuffer();
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
            const contentType = storageBlob.type || inferType(storagePath);
            const mediaId = await uploadMedia(undefined, { arrayBuffer, contentType, oauth2Token });
            mediaIds = [mediaId];
            console.log("Media uploaded successfully from storage override, media_id:", mediaId);
          } else if (book.image_url) {
            console.log("Uploading media from image_url...");
            const mediaId = await uploadMedia(book.image_url, { oauth2Token });
            mediaIds = [mediaId];
            console.log("Media uploaded successfully, media_id:", mediaId);
          }
        } catch (error) {
          console.error("Failed to upload media, continuing without image:", error);
        }

        // Send tweet with retry logic for rate limiting (using user's OAuth2 token)
        const tweetResponse = await sendTweetWithRetry(tweetText, mediaIds, oauth2Token);
        console.log("Tweet sent successfully:", tweetResponse);

        // Get or create platform content record
        const { data: existingContent } = await supabaseClient
          .from('book_platform_content')
          .select('*')
          .eq('book_id', id)
          .eq('platform', 'x')
          .maybeSingle();

        if (existingContent) {
          // Update existing record
          const { error: updateError } = await supabaseClient
            .from('book_platform_content')
            .update({ 
              published: true,
              published_at: new Date().toISOString(),
              post_id: tweetResponse.data?.id
            })
            .eq('id', existingContent.id);

          if (updateError) throw updateError;
        } else {
          // Create new record
          const { error: insertError } = await supabaseClient
            .from('book_platform_content')
            .insert({
              book_id: id,
              platform: 'x',
              published: true,
              published_at: new Date().toISOString(),
              post_id: tweetResponse.data?.id,
              ai_generated_text: book.ai_generated_text
            });

          if (insertError) throw insertError;
        }

        results.push({ 
          id, 
          success: true, 
          tweetId: tweetResponse.data?.id 
        });

      } catch (error: any) {
        console.error(`Error publishing book ${id}:`, error);
        results.push({ 
          id, 
          success: false, 
          error: error.message 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: results.every(r => r.success), // true only if all succeeded
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in publish-to-x function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
