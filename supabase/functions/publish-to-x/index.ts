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
  const signatureBaseString = `${method}&${encodeURIComponent(
    url
  )}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(
    consumerSecret
  )}&${encodeURIComponent(tokenSecret)}`;
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

async function testConnection(): Promise<any> {
  const url = `${BASE_URL}/users/me`;
  const method = "GET";
  const oauthHeader = generateOAuthHeader(method, url);
  
  console.log("=== Testing Twitter OAuth 1.0a Connection ===");
  
  const response = await fetch(url, {
    method: method,
    headers: {
      Authorization: oauthHeader,
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

async function uploadMedia(imageUrl: string): Promise<string> {
  console.log("Downloading image from:", imageUrl);
  
  // Download image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  
  const imageBlob = await imageResponse.blob();
  const imageBuffer = await imageBlob.arrayBuffer();
  const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
  
  console.log("Image downloaded, size:", imageBuffer.byteLength, "bytes");
  
  // Upload to Twitter
  const method = "POST";
  const oauthHeader = generateOAuthHeader(method, UPLOAD_URL);
  
  const formData = new FormData();
  formData.append("media_data", imageBase64);
  
  const response = await fetch(UPLOAD_URL, {
    method: method,
    headers: {
      Authorization: oauthHeader,
    },
    body: formData,
  });
  
  const responseText = await response.text();
  console.log("Media Upload Response Status:", response.status);
  console.log("Media Upload Response Body:", responseText);
  
  if (!response.ok) {
    throw new Error(`Failed to upload media: ${response.status}, body: ${responseText}`);
  }
  
  const result = JSON.parse(responseText);
  return result.media_id_string;
}

async function sendTweet(tweetText: string, mediaIds?: string[]): Promise<any> {
  const url = `${BASE_URL}/tweets`;
  const method = "POST";
  
  const body: any = { text: tweetText };
  if (mediaIds && mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }
  
  const oauthHeader = generateOAuthHeader(method, url);
  
  console.log("Sending tweet with OAuth 1.0a...");
  console.log("Tweet body:", JSON.stringify(body));
  
  const response = await fetch(url, {
    method: method,
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  const responseText = await response.text();
  console.log("Tweet Response Status:", response.status);
  console.log("Tweet Response Body:", responseText);
  
  if (!response.ok) {
    throw new Error(`Failed to send tweet: ${response.status}, body: ${responseText}`);
  }
  
  return JSON.parse(responseText);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    validateEnvironmentVariables();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookId, bookIds, testConnection: shouldTestConnection } = await req.json();
    
    // Test connection endpoint
    if (shouldTestConnection) {
      console.log("Testing Twitter API connection...");
      const result = await testConnection();
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Connection successful! Your API keys are working.",
          user: result.data 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log("Received request:", { bookId, bookIds });

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

        // Check if already published
        if (book.published) {
          console.log(`Book ${id} already published, skipping`);
          results.push({ id, success: false, error: "Already published" });
          continue;
        }

        // Format tweet based on template type
        let tweetText = '';
        const isVisualTemplate = book.template_type === 'visual';
        
        console.log(`Using ${isVisualTemplate ? 'visual' : 'text'} template for book ${id}`);
        
        if (isVisualTemplate) {
          // Visual template: Short text with product link (Twitter will show card preview)
          tweetText = `📚 ${book.title}\n\n`;
          
          if (book.sale_price) {
            tweetText += `💰 ${book.sale_price} zł\n\n`;
          }
          
          if (book.product_url) {
            tweetText += `${book.product_url}`;
          }
        } else {
          // Text template: Full text format
          tweetText = `📚 Nowość w ofercie!\n\n${book.title}\n\n`;
          
          if (book.sale_price) {
            tweetText += `💰 Cena: ${book.sale_price} zł\n\n`;
          }
          
          if (book.product_url) {
            tweetText += `Sprawdź: ${book.product_url}\n\n`;
          }
          
          tweetText += `#ksiazki #antyk #promocja`;
        }

        console.log("Tweet to send:", tweetText);

        // Upload media if image_url exists
        let mediaIds: string[] | undefined = undefined;
        if (book.image_url && isVisualTemplate) {
          try {
            console.log("Uploading media for visual template...");
            const mediaId = await uploadMedia(book.image_url);
            mediaIds = [mediaId];
            console.log("Media uploaded successfully, media_id:", mediaId);
          } catch (error) {
            console.error("Failed to upload media, continuing without image:", error);
            // Continue without media if upload fails
          }
        }

        // Send tweet
        const tweetResponse = await sendTweet(tweetText, mediaIds);
        console.log("Tweet sent successfully:", tweetResponse);

        // Update book as published
        const { error: updateError } = await supabaseClient
          .from('books')
          .update({ published: true })
          .eq('id', id);

        if (updateError) throw updateError;

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
