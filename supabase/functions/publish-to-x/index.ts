import { createHmac } from "node:crypto";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");

  console.log("Signature Base String:", signatureBaseString);
  console.log("Generated Signature:", signature);

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

async function testConnection(): Promise<any> {
  const url = "https://api.x.com/2/users/me";
  const method = "GET";

  const oauthHeader = generateOAuthHeader(method, url);
  console.log("Test Connection - OAuth Header:", oauthHeader);

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
    throw new Error(
      `HTTP error! status: ${response.status}, body: ${responseText}`
    );
  }

  return JSON.parse(responseText);
}

async function sendTweet(tweetText: string): Promise<any> {
  const url = "https://api.x.com/2/tweets";
  const method = "POST";
  const params = { text: tweetText };

  const oauthHeader = generateOAuthHeader(method, url);
  console.log("OAuth Header:", oauthHeader);

  const response = await fetch(url, {
    method: method,
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const responseText = await response.text();
  console.log("Response Status:", response.status);
  console.log("Response Body:", responseText);

  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status}, body: ${responseText}`
    );
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

        // Format tweet
        let tweetText = `📚 Nowość w ofercie!\n\n${book.title}\n\n`;
        
        if (book.promotional_price && book.promotional_price > 0) {
          tweetText += `💰 Cena: ${book.sale_price} zł\n🔥 Promocja: ${book.promotional_price} zł\n\n`;
        } else if (book.sale_price) {
          tweetText += `💰 Cena: ${book.sale_price} zł\n\n`;
        }
        
        if (book.image_url) {
          tweetText += `Sprawdź: ${book.image_url}\n\n`;
        }
        
        tweetText += `#ksiazki #antyk #promocja`;

        console.log("Tweet to send:", tweetText);

        // Send tweet
        const tweetResponse = await sendTweet(tweetText);
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
