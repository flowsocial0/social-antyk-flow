import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Book {
  id: string;
  code: string;
  title: string;
  author?: string;
  sale_price: number;
  promotional_price?: number;
  product_url?: string;
  image_url?: string;
  storage_path?: string;
  ai_generated_text?: string;
  ai_text_facebook?: string;
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
    let finalImageUrl = imageUrl || '';
    let book: Book | null = null;

    // Helper function to validate and fix URL format
    const validateUrl = (url: string): string => {
      if (!url) {
        console.log('validateUrl: empty URL provided');
        return '';
      }
      let fixedUrl = url.trim();
      
      // Remove any whitespace, newlines within the URL
      fixedUrl = fixedUrl.replace(/\s+/g, '');
      
      // Fix common URL issues - missing :// after protocol
      if (fixedUrl.match(/^https?:[^/]/)) {
        console.log('validateUrl: fixing missing :// in URL:', url);
        fixedUrl = fixedUrl.replace(/^(https?):([^/])/, '$1://$2');
      }
      
      // Add https:// if missing protocol
      if (!fixedUrl.match(/^https?:\/\//)) {
        fixedUrl = 'https://' + fixedUrl;
      }
      
      // Validate URL format
      try {
        new URL(fixedUrl);
        console.log('validateUrl: valid URL:', fixedUrl);
        return fixedUrl;
      } catch {
        console.warn('validateUrl: Invalid URL format after fixing, skipping. Original:', url, 'Fixed attempt:', fixedUrl);
        return '';
      }
    };

    // Helper function to fix broken URLs in text
    const fixUrlsInText = (text: string): string => {
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
      
      // Fix "sklep.antyk" patterns specifically - handles "p ,name, .html" -> "p,name.html"
      result = result.replace(
        /(https?:\/\/sklep\.antyk\.org\.pl\/p)\s*,?\s*([\w\-]+)\s*,?\s*\.?\s*(html?)/gi,
        '$1,$2.$3'
      );
      
      // Fix broken product URLs like "/p 123,p html" or "/p 123 html" -> "/p123,p.html"
      result = result.replace(
        /(\/p)\s+([\d\w\-,]+)\s*(\.?\s*html?)/gi,
        '$1$2.html'
      );
      
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
    };

    // Helper function to get public URL from storage path
    const getStoragePublicUrl = (storagePath: string): string => {
      if (!storagePath) return '';
      const bucketName = 'ObrazkiKsiazek';
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${storagePath}`;
      console.log('Generated storage public URL:', publicUrl);
      return publicUrl;
    };

    // If it's a book post, get book details
    if (bookId) {
      console.log('Fetching book data for bookId:', bookId);
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookError) {
        console.error('Error fetching book:', bookError);
        throw new Error('Book not found');
      }

      book = bookData;
      console.log('Book data:', { 
        title: book?.title, 
        image_url: book?.image_url ? 'present' : 'missing',
        storage_path: book?.storage_path ? 'present' : 'missing',
        product_url: book?.product_url,
        ai_text_facebook: book?.ai_text_facebook ? 'present' : 'missing'
      });

      productUrl = validateUrl(book?.product_url || '');

      // Use platform-specific AI text (ai_text_facebook) first, then fallback to legacy ai_generated_text
      const aiTextForFacebook = book?.ai_text_facebook || book?.ai_generated_text;
      if (aiTextForFacebook) {
        postText = aiTextForFacebook;
        // Always append product URL if not already in text
        if (productUrl && postText && !postText.includes(productUrl)) {
          postText += `\n\n🔗 ${productUrl}`;
        }
      } else {
        const price = book?.promotional_price || book?.sale_price;
        postText = `📚 ${book?.title}\n\n💰 Cena: ${price} zł${productUrl ? `\n\n🔗 Sprawdź szczegóły: ${productUrl}` : ''}`;
      }

      // Get image URL from book if not provided
      if (!finalImageUrl) {
        if (book?.image_url) {
          finalImageUrl = book.image_url;
          console.log('Using book.image_url:', finalImageUrl);
        } else if (book?.storage_path) {
          finalImageUrl = getStoragePublicUrl(book.storage_path);
          console.log('Using storage_path URL:', finalImageUrl);
        }
      }
    }

    // If it's a campaign post, get the text from campaign_posts
    if (campaignPostId) {
      console.log('Fetching campaign post data for campaignPostId:', campaignPostId);
      const { data: campaignPost, error: campaignError } = await supabase
        .from('campaign_posts')
        .select('*, book:books(*)')
        .eq('id', campaignPostId)
        .single();

      if (campaignError) {
        console.error('Error fetching campaign post:', campaignError);
        throw new Error('Campaign post not found');
      }

      console.log('Campaign post data:', {
        type: campaignPost.type,
        text: campaignPost.text ? 'present' : 'missing',
        book_id: campaignPost.book_id,
        book: campaignPost.book ? 'present' : 'missing'
      });

      postText = campaignPost.text;
      book = campaignPost.book;

      // For sales posts, append book link and get image
      if (campaignPost.type === 'sales' && book) {
        productUrl = validateUrl(book.product_url || '');
        
        // Always append product URL if not already in text
        if (productUrl && postText && !postText.includes(productUrl)) {
          postText += `\n\n🔗 ${productUrl}`;
        }

        // Get image URL from book if not provided
        if (!finalImageUrl) {
          if (book.image_url) {
            finalImageUrl = book.image_url;
            console.log('Using campaign book.image_url:', finalImageUrl);
          } else if (book.storage_path) {
            finalImageUrl = getStoragePublicUrl(book.storage_path);
            console.log('Using campaign book storage_path URL:', finalImageUrl);
          }
        }
      }

      // For content/trivia posts, extract link from text for Facebook preview
      if (campaignPost.type === 'content') {
        // Extract first URL from text
        const urlMatch = postText?.match(/(https?:\/\/[^\s\n,]+)/);
        if (urlMatch) {
          productUrl = validateUrl(urlMatch[1]);
          console.log('Extracted URL from content post:', productUrl);
        } else {
          // Default bookstore URL if no URL found in text
          productUrl = 'https://sklep.antyk.org.pl';
          console.log('No URL in content post, using default bookstore URL');
        }
      }
    }

    // Fix any broken URLs in the text before publishing
    if (postText) {
      postText = fixUrlsInText(postText);
    }

    // Add AI disclaimer for Facebook
    if (postText) {
      postText += '\n\nTekst wygenerowany przez sztuczny algorytm';
    }

    console.log('=== Final Publishing Data ===');
    console.log('Post text length:', postText?.length);
    console.log('Product URL:', productUrl || 'none');
    console.log('Image URL:', finalImageUrl || 'none');

    // Publish to Facebook
    let fbPostId = null;

    if (finalImageUrl) {
      // Two-step process: 1) Upload photo unpublished 2) Create feed post with attached media
      console.log('=== Publishing with image (two-step process) ===');
      
      // Step 1: Upload photo as unpublished
      const photosUrl = `https://graph.facebook.com/v18.0/${page_id}/photos`;
      const photoData = {
        url: finalImageUrl,
        published: false, // Important: don't publish yet
        access_token: access_token,
      };

      console.log('Step 1: Uploading unpublished photo...');
      const photoResponse = await fetch(photosUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photoData),
      });

      const photoResult = await photoResponse.json();
      console.log('Photo upload response:', { status: photoResponse.status, result: photoResult });

      if (!photoResponse.ok || photoResult.error) {
        console.error('Facebook photo upload error:', photoResult);
        // Fallback: try direct photo post with caption
        console.log('Fallback: trying direct photo post with caption...');
        const directPhotoData = {
          url: finalImageUrl,
          caption: postText,
          access_token: access_token,
        };
        
        const directPhotoResponse = await fetch(photosUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(directPhotoData),
        });
        
        const directPhotoResult = await directPhotoResponse.json();
        console.log('Direct photo post response:', { status: directPhotoResponse.status, result: directPhotoResult });
        
        if (!directPhotoResponse.ok || directPhotoResult.error) {
          throw new Error(directPhotoResult.error?.message || 'Failed to publish photo to Facebook');
        }
        
        fbPostId = directPhotoResult.id || directPhotoResult.post_id;
      } else {
        // Step 2: Create feed post with attached media
        const mediaFbId = photoResult.id;
        console.log('Photo uploaded, media_fbid:', mediaFbId);

        const feedUrl = `https://graph.facebook.com/v18.0/${page_id}/feed`;
        const feedData: any = {
          message: postText,
          attached_media: JSON.stringify([{ media_fbid: mediaFbId }]),
          access_token: access_token,
        };

        // Add link for better preview if available
        if (productUrl) {
          feedData.link = productUrl;
        }

        console.log('Step 2: Creating feed post with attached media...');
        const feedResponse = await fetch(feedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedData),
        });

        const feedResult = await feedResponse.json();
        console.log('Feed post response:', { status: feedResponse.status, result: feedResult });

        if (!feedResponse.ok || feedResult.error) {
          console.error('Facebook feed post error:', feedResult);
          // If feed post fails, the photo is already uploaded, try simpler approach
          console.log('Fallback: publishing photo directly with caption...');
          const fallbackPhotoData = {
            url: finalImageUrl,
            caption: postText,
            access_token: access_token,
          };
          
          const fallbackResponse = await fetch(photosUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPhotoData),
          });
          
          const fallbackResult = await fallbackResponse.json();
          console.log('Fallback photo response:', { status: fallbackResponse.status, result: fallbackResult });
          
          if (!fallbackResponse.ok || fallbackResult.error) {
            throw new Error(fallbackResult.error?.message || feedResult.error?.message || 'Failed to publish to Facebook');
          }
          
          fbPostId = fallbackResult.id || fallbackResult.post_id;
        } else {
          fbPostId = feedResult.id;
        }
      }

      console.log('Published to Facebook with image, post ID:', fbPostId);
    } else {
      // Text-only post
      console.log('=== Publishing text-only post ===');
      const fbApiUrl = `https://graph.facebook.com/v18.0/${page_id}/feed`;
      const postData: any = {
        message: postText,
        access_token: access_token,
      };

      // Add link only if it's a valid URL
      if (productUrl) {
        postData.link = productUrl;
      }

      console.log('Publishing text post to Facebook...');
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
      console.log('Published text post to Facebook, post ID:', fbPostId);
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
