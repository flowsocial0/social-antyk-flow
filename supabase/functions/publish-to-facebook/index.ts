import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Book {
  id: string;
  code: string;
  title: string;
  sale_price: number;
  promotional_price?: number;
  product_url?: string;
  storage_path?: string;
  ai_generated_text?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let text: string | undefined,
        bookId: string | undefined,
        campaignPostId: string | undefined,
        imageUrl: string | undefined,
        testConnection: boolean | undefined;
    try {
      ({ text, bookId, campaignPostId, imageUrl, testConnection } = await req.json());
    } catch (_) {
      // No/invalid JSON body – treat as test connection if nothing else is provided
      testConnection = true;
    }

    const isTest = Boolean(testConnection) || (!text && !bookId && !campaignPostId);


    // Get Facebook Page Access Token
    const { data: tokenData, error: tokenError } = await supabase
      .from('facebook_oauth_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Error fetching Facebook token:', tokenError);
      throw new Error('Facebook not connected. Please connect your Facebook account first.');
    }

    const { access_token, page_id, page_name, expires_at } = tokenData;

    // Check if token is expired
    if (expires_at && new Date(expires_at) < new Date()) {
      throw new Error('Facebook token expired. Please reconnect your Facebook account.');
    }

    console.log('Publishing to Facebook Page:', page_name, page_id);

    // If it's just a connection test, return success
    if (isTest) {
      return new Response(
        JSON.stringify({
          success: true,
          connected: true,
          pageName: page_name,
          pageId: page_id,
          platform: 'facebook',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let postText = text;
    let productUrl = '';

    // If it's a book post, get book details
    if (bookId) {
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookError) {
        console.error('Error fetching book:', bookError);
        throw new Error('Book not found');
      }

      productUrl = book.product_url || '';

      // Use AI generated text or create a simple post
      if (book.ai_generated_text) {
        postText = book.ai_generated_text;
      } else {
        const price = book.promotional_price || book.sale_price;
        postText = `📚 ${book.title}\n\n💰 Cena: ${price} zł\n\n🔗 Sprawdź szczegóły: ${productUrl}`;
      }
    }

    // If it's a campaign post, get the text from campaign_posts
    if (campaignPostId) {
      const { data: campaignPost, error: campaignError } = await supabase
        .from('campaign_posts')
        .select('*, books(*)')
        .eq('id', campaignPostId)
        .single();

      if (campaignError) {
        console.error('Error fetching campaign post:', campaignError);
        throw new Error('Campaign post not found');
      }

      postText = campaignPost.text;

      // For sales posts, append book link
      if (campaignPost.type === 'sales' && campaignPost.books) {
        productUrl = campaignPost.books.product_url || '';
        if (productUrl) {
          postText += `\n\n🔗 ${productUrl}`;
        }
      }
    }

    console.log('Post text:', postText);
    console.log('Product URL:', productUrl);

    // Prepare Facebook API request
    const fbApiUrl = `https://graph.facebook.com/v18.0/${page_id}/feed`;
    const postData: any = {
      message: postText,
      access_token: access_token,
    };

    // Add link if available
    if (productUrl) {
      postData.link = productUrl;
    }

    // If there's an image, use photos endpoint instead
    let fbPostId = null;
    if (imageUrl) {
      const photosUrl = `https://graph.facebook.com/v18.0/${page_id}/photos`;
      const photoData = {
        url: imageUrl,
        caption: postText,
        access_token: access_token,
      };

      console.log('Publishing photo to Facebook...');
      const photoResponse = await fetch(photosUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photoData),
      });

      const photoResult = await photoResponse.json();

      if (!photoResponse.ok || photoResult.error) {
        console.error('Facebook photo API error:', photoResult);
        throw new Error(photoResult.error?.message || 'Failed to publish photo to Facebook');
      }

      fbPostId = photoResult.id || photoResult.post_id;
      console.log('Published photo to Facebook, post ID:', fbPostId);
    } else {
      console.log('Publishing text post to Facebook...');
      const postResponse = await fetch(fbApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      const postResult = await postResponse.json();

      if (!postResponse.ok || postResult.error) {
        console.error('Facebook API error:', postResult);
        throw new Error(postResult.error?.message || 'Failed to publish to Facebook');
      }

      fbPostId = postResult.id;
      console.log('Published to Facebook, post ID:', fbPostId);
    }

    // Update book status if it was a book post
    if (bookId && !campaignPostId) {
      await supabase
        .from('books')
        .update({ published: true })
        .eq('id', bookId);
      console.log('Updated book published status');
    }

    return new Response(
      JSON.stringify({
        success: true,
        postId: fbPostId,
        platform: 'facebook',
        page_name: page_name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Facebook publish error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        platform: 'facebook'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});