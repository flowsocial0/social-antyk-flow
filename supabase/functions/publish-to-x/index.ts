import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const CLIENT_ID = Deno.env.get("TWITTER_OAUTH2_CLIENT_ID")?.trim();
const CLIENT_SECRET = Deno.env.get("TWITTER_OAUTH2_CLIENT_SECRET")?.trim();

async function getAccessToken(supabaseClient: any): Promise<string> {
  const { data, error } = await supabaseClient
    .from('twitter_oauth_tokens')
    .select('access_token, expires_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error('No Twitter access token found. Please authorize the app first.');
  }

  // Check if token is expired
  if (data.expires_at) {
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      throw new Error('Twitter access token has expired. Please re-authorize the app.');
    }
  }

  return data.access_token;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function validateEnvironmentVariables() {
  if (!CLIENT_ID) throw new Error("Missing TWITTER_OAUTH2_CLIENT_ID environment variable");
  if (!CLIENT_SECRET) throw new Error("Missing TWITTER_OAUTH2_CLIENT_SECRET environment variable");
}

function getAuthHeaders(accessToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function testConnection(accessToken: string): Promise<any> {
  const url = "https://api.x.com/2/users/me";

  console.log("=== Testing Twitter OAuth 2.0 Connection ===");
  console.log("Access Token (first 10 chars):", accessToken?.substring(0, 10) + "...");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders(accessToken),
    });

    const responseText = await response.text();
    console.log("Test Connection - Response Status:", response.status);
    console.log("Test Connection - Response Body:", responseText);

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseText);
      } catch (e) {
        errorDetails = responseText;
      }
      throw new Error(
        `HTTP error! status: ${response.status}, details: ${JSON.stringify(errorDetails)}`
      );
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error("Test Connection - Error:", error);
    throw error;
  }
}

async function sendTweet(tweetText: string, accessToken: string): Promise<any> {
  const url = "https://api.x.com/2/tweets";
  const body = { text: tweetText };

  console.log("Sending tweet with OAuth 2.0...");

  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log("Tweet Response Status:", response.status);
  console.log("Tweet Response Body:", responseText);

  if (!response.ok) {
    let errorDetails;
    try {
      errorDetails = JSON.parse(responseText);
    } catch (e) {
      errorDetails = responseText;
    }
    throw new Error(
      `HTTP error! status: ${response.status}, details: ${JSON.stringify(errorDetails)}`
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
    
    // Get access token from database
    const accessToken = await getAccessToken(supabaseClient);
    
    // Test connection endpoint
    if (shouldTestConnection) {
      console.log("Testing Twitter API connection...");
      const result = await testConnection(accessToken);
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
        const tweetResponse = await sendTweet(tweetText, accessToken);
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
