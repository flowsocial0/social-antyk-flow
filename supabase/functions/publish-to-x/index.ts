import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { createHmac } from "node:crypto";

const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();

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

const BASE_URL = "https://api.x.com/2";
const UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";

async function getLatestOAuth1Token(supabaseClient: any, userId: string): Promise<{ oauth_token: string; oauth_token_secret: string; screen_name?: string } | null> {
  const { data, error } = await supabaseClient
    .from('twitter_oauth1_tokens')
    .select('oauth_token, oauth_token_secret, screen_name')
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
): Promise<any> {
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
    body: responseText
  });

  if (!response.ok) {
    throw new Error(`Failed to send tweet: ${response.status}, body: ${responseText}`);
  }

  const responseData = JSON.parse(responseText);
  console.log("✅ Tweet published successfully:", {
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
    
    const authHeader = req.headers.get('authorization');
    console.log('Authorization header:', authHeader ? 'present' : 'MISSING');
    
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Check if this is a service role call
    const isServiceRole = authHeader.includes(supabaseServiceKey);
    let userId: string;
    
    if (isServiceRole) {
      console.log('🔧 Service role call detected (from auto-publish-books cron)');
      const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: tokenData, error: tokenError } = await serviceSupabase
        .from('twitter_oauth1_tokens')
        .select('user_id')
        .limit(1)
        .single();
      
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
      if (userError || !user) {
        console.error('Failed to get user from token:', userError);
        throw new Error('Failed to get user from token');
      }

      userId = user.id;
      console.log('User ID:', userId);
    }
    
    validateEnvironmentVariables();
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { bookId, bookIds, campaignPostId, testConnection: shouldTestConnection, storageBucket, storagePath, customText } = await req.json();
    console.log('Request body:', { bookId, bookIds: bookIds ? `${bookIds.length} items` : undefined, campaignPostId, testConnection: shouldTestConnection, storageBucket, storagePath });
    
    // Fetch user's OAuth 1.0a tokens
    const oauth1Token = await getLatestOAuth1Token(supabaseClient, userId);
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
    
    // Test connection endpoint
    if (shouldTestConnection) {
      console.log("Testing Twitter API connection with OAuth 1.0a...");
      
      try {
        const testUrl = "https://api.twitter.com/1.1/account/verify_credentials.json";
        const testMethod = "GET";
        const testHeader = generateOAuthHeader(testUrl, testMethod, oauth1Token.oauth_token, oauth1Token.oauth_token_secret);
        
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

    // Handle campaign post
    if (campaignPostId) {
      try {
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

        if (campaignPost.status === 'published') {
          console.log(`Campaign post ${campaignPostId} already published, skipping`);
          return new Response(
            JSON.stringify({ success: false, error: "Already published" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let tweetText = campaignPost.text + '\n\n(ai)';

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

        const tweetResponse = await sendTweetWithRetry(tweetText, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, mediaIds);
        console.log("Tweet sent successfully:", tweetResponse);

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
        
        const isRateLimitError = error.statusCode === 429 || 
          error.message?.includes('429') || 
          error.message?.includes('Too Many Requests') ||
          error.message?.includes('rate limit');
        
        if (isRateLimitError) {
          const { data: currentPost } = await supabaseClient
            .from('campaign_posts')
            .select('retry_count')
            .eq('id', campaignPostId)
            .single();
          
          const retryCount = (currentPost?.retry_count || 0) + 1;
          
          const retryDelays = [15, 30, 60];
          const delayMinutes = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];
          const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
          
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

        if (platformContent?.published) {
          console.log(`Book ${id} already published on X, skipping`);
          results.push({ id, success: false, error: "Already published on this platform" });
          continue;
        }

        let tweetText;
        if (book.ai_generated_text) {
          tweetText = `${book.ai_generated_text}\n\n${book.product_url}\n\n(ai)`;
          console.log("Using AI-generated text from database");
        } else if (customText) {
          tweetText = `${customText}\n\n(ai)`;
          console.log("Using custom text parameter");
        } else {
          tweetText = `✨ LIMITOWANA OFERTA ✨\n\n📚 ${book.title}\n\n`;
          
          if (book.sale_price) {
            tweetText += `💰 Tylko ${book.sale_price} zł\n\n`;
          }
          
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
            const mediaId = await uploadMedia(undefined, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, { arrayBuffer, contentType });
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
            const mediaId = await uploadMedia(undefined, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, { arrayBuffer, contentType });
            mediaIds = [mediaId];
            console.log("Media uploaded successfully from storage override, media_id:", mediaId);
          } else if (book.image_url) {
            console.log("Uploading media from image_url...");
            const mediaId = await uploadMedia(book.image_url, oauth1Token.oauth_token, oauth1Token.oauth_token_secret);
            mediaIds = [mediaId];
            console.log("Media uploaded successfully, media_id:", mediaId);
          }
        } catch (error) {
          console.error("Failed to upload media, continuing without image:", error);
        }

        const tweetResponse = await sendTweetWithRetry(tweetText, oauth1Token.oauth_token, oauth1Token.oauth_token_secret, mediaIds);
        console.log("Tweet sent successfully:", tweetResponse);

        const { data: existingContent } = await supabaseClient
          .from('book_platform_content')
          .select('*')
          .eq('book_id', id)
          .eq('platform', 'x')
          .maybeSingle();

        if (existingContent) {
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
        success: results.every(r => r.success),
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