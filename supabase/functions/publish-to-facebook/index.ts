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
    console.log('=== Publish to Facebook Request ===');
    console.log('Method:', req.method);
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    let userId: string | null = null;
    
    // Parse request body first to check for userId parameter (from auto-publish)
    let text: string | undefined,
        bookId: string | undefined,
        campaignPostId: string | undefined,
        imageUrl: string | undefined,
        testConnection: boolean | undefined,
        userIdFromBody: string | undefined;
    
    try {
      const body = await req.json();
      text = body.text;
      bookId = body.bookId;
      campaignPostId = body.campaignPostId;
      imageUrl = body.imageUrl;
      testConnection = body.testConnection;
      userIdFromBody = body.userId;
      console.log('Request body:', { 
        text: text ? 'present' : undefined, 
        bookId, 
        campaignPostId, 
        imageUrl: imageUrl ? 'present' : undefined, 
        testConnection,
        userId: userIdFromBody ? 'present' : undefined
      });
    } catch (_) {
      testConnection = true;
      console.log('No valid JSON body, treating as test connection');
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
        const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

    if (!userId) {
      throw new Error('No user ID available. Please provide userId in request body or valid authorization header.');
    }

    console.log('Final User ID:', userId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const isTest = Boolean(testConnection) || (!text && !bookId && !campaignPostId);
    console.log('Is test connection:', isTest);

    // Get Facebook Page Access Token for this user
    console.log('Fetching Facebook token for user:', userId);
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('facebook_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError) {
      console.error('Error fetching Facebook token:', tokenError);
      throw new Error('Error fetching Facebook token: ' + tokenError.message);
    }
    
    if (!tokenData) {
      console.error('No Facebook token found for user:', userId);
      throw new Error('Facebook not connected. Please connect your Facebook account first.');
    }

    const { access_token, page_id, page_name, expires_at } = tokenData;
    console.log('Found Facebook token:', { page_id, page_name, expires_at });

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

    // Helper function to validate and fix URL format
    const validateUrl = (url: string): string => {
      if (!url) return '';
      let fixedUrl = url.trim();
      
      // Fix common URL issues - missing :// after protocol
      if (fixedUrl.match(/^https?:[^/]/)) {
        fixedUrl = fixedUrl.replace(/^(https?):([^/])/, '$1://$2');
      }
      
      // Add https:// if missing protocol
      if (!fixedUrl.match(/^https?:\/\//)) {
        fixedUrl = 'https://' + fixedUrl;
      }
      
      // Validate URL format
      try {
        new URL(fixedUrl);
        return fixedUrl;
      } catch {
        console.warn('Invalid URL format, skipping:', url);
        return '';
      }
    };

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

      productUrl = validateUrl(book.product_url || '');
      console.log('Validated product URL:', productUrl);

      // Use platform-specific AI text (ai_text_facebook) first, then fallback to legacy ai_generated_text
      const aiTextForFacebook = book.ai_text_facebook || book.ai_generated_text;
      if (aiTextForFacebook) {
        postText = aiTextForFacebook;
      } else {
        const price = book.promotional_price || book.sale_price;
        postText = `📚 ${book.title}\n\n💰 Cena: ${price} zł${productUrl ? `\n\n🔗 Sprawdź szczegóły: ${productUrl}` : ''}`;
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
        productUrl = validateUrl(campaignPost.books.product_url || '');
        if (productUrl) {
          postText += `\n\n🔗 ${productUrl}`;
        }
      }
    }

    // Add AI disclaimer for Facebook
    if (postText) {
      postText += '\n\nTekst wygenerowany przez sztuczny algorytm';
    }

    console.log('Post text:', postText);
    console.log('Product URL:', productUrl);

    // Prepare Facebook API request
    const fbApiUrl = `https://graph.facebook.com/v18.0/${page_id}/feed`;
    const postData: any = {
      message: postText,
      access_token: access_token,
    };

    // Add link only if it's a valid URL
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

      console.log('Publishing photo to Facebook...', { photosUrl, page_id });
      const photoResponse = await fetch(photosUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photoData),
      });

      const photoResult = await photoResponse.json();
      console.log('Facebook photo API response:', { status: photoResponse.status, result: photoResult });

      if (!photoResponse.ok || photoResult.error) {
        console.error('Facebook photo API error:', photoResult);
        throw new Error(photoResult.error?.message || 'Failed to publish photo to Facebook');
      }

      fbPostId = photoResult.id || photoResult.post_id;
      console.log('Published photo to Facebook, post ID:', fbPostId);
    } else {
      console.log('Publishing text post to Facebook...', { fbApiUrl, page_id });
      const postResponse = await fetch(fbApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      const postResult = await postResponse.json();
      console.log('Facebook API response:', { status: postResponse.status, result: postResult });

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
