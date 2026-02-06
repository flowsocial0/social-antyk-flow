import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to wait for container to be ready
async function waitForContainer(containerId: string, accessToken: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await response.json();
    
    console.log(`Container status check ${i + 1}:`, data.status_code);
    
    if (data.status_code === 'FINISHED') {
      return true;
    } else if (data.status_code === 'ERROR') {
      throw new Error('Container processing failed');
    }
    
    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

// Check if URL is a video based on extension
function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(url);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Publish to Instagram Request ===');
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let userId: string | null = null;
    let bookId: string | undefined;
    let contentId: string | undefined;
    let campaignPostId: string | undefined;
    let caption: string | undefined;
    let imageUrl: string | undefined;
    let videoUrl: string | undefined;  // NEW: Support for video
    let testConnection: boolean | undefined;
    let userIdFromBody: string | undefined;
    let accountId: string | undefined;

    try {
      const body = await req.json();
      bookId = body.bookId;
      contentId = body.contentId;
      campaignPostId = body.campaignPostId;
      caption = body.caption || body.text;
      imageUrl = body.imageUrl;
      videoUrl = body.videoUrl;  // NEW: Extract videoUrl from request
      testConnection = body.testConnection;
      userIdFromBody = body.userId;
      accountId = body.accountId;
      
      console.log('Request body:', { 
        bookId, 
        contentId,
        campaignPostId,
        caption: caption ? 'present' : undefined,
        imageUrl: imageUrl ? 'present' : undefined,
        videoUrl: videoUrl ? 'present' : undefined,  // NEW: Log videoUrl
        testConnection,
        userId: userIdFromBody ? 'present' : undefined,
        accountId: accountId || 'not specified (will use default)'
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
      throw new Error('Musisz być zalogowany aby publikować na Instagram');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Instagram token from database
    console.log('Fetching Instagram token for user:', userId, 'accountId:', accountId || 'default');
    
    let tokenQuery = supabase
      .from('instagram_oauth_tokens')
      .select('*')
      .eq('user_id', userId);

    if (accountId) {
      tokenQuery = tokenQuery.eq('id', accountId);
    } else {
      tokenQuery = tokenQuery.eq('is_default', true);
    }

    let { data: tokenData, error: tokenError } = await tokenQuery.maybeSingle();

    // If no default account found, try to get any account for this user
    if (!tokenData && !accountId) {
      console.log('No default account found, trying to get any account...');
      const { data: anyToken, error: anyTokenError } = await supabase
        .from('instagram_oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      
      tokenData = anyToken;
      tokenError = anyTokenError;
    }

    if (tokenError) {
      console.error('Error fetching Instagram token:', tokenError);
      throw new Error('Błąd pobierania tokenu Instagram: ' + tokenError.message);
    }
    
    if (!tokenData) {
      console.error('No Instagram token found for user:', userId, 'accountId:', accountId);
      throw new Error(accountId 
        ? `Konto Instagram (${accountId}) nie znalezione. Konto mogło zostać odłączone.`
        : 'Instagram nie jest połączony. Połącz konto Instagram w ustawieniach.');
    }

    const { id: tokenId, access_token, instagram_account_id, instagram_username, expires_at } = tokenData;
    console.log('Using Instagram account:', { tokenId, instagram_account_id, instagram_username });
    console.log('Found Instagram token:', { instagram_account_id, instagram_username, expires_at });

    // Check if token is expired
    if (expires_at && new Date(expires_at) < new Date()) {
      throw new Error('Token Instagram wygasł. Połącz ponownie konto Instagram.');
    }

    // If it's just a connection test, return success
    const isTest = Boolean(testConnection) || (!bookId && !contentId && !campaignPostId && !caption && !imageUrl && !videoUrl);
    console.log('Is test connection:', isTest);
    
    if (isTest) {
      return new Response(
        JSON.stringify({
          success: true,
          connected: true,
          accountName: instagram_username,
          accountId: instagram_account_id,
          platform: 'instagram',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Helper function to get public URL from storage path
    const getStoragePublicUrl = (storagePath: string): string => {
      if (!storagePath) return '';
      const bucketName = 'ObrazkiKsiazek';
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${storagePath}`;
      console.log('Generated storage public URL:', publicUrl);
      return publicUrl;
    };

    let postCaption = caption || '';
    let finalImageUrl = imageUrl || '';
    let finalVideoUrl = videoUrl || '';  // NEW: Track video URL

    // If bookId provided, get book data
    if (bookId) {
      console.log('Fetching book data for bookId:', bookId);
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookError) {
        console.error('Error fetching book:', bookError);
        throw new Error('Nie znaleziono książki');
      }

      console.log('Book data:', { 
        title: book?.title, 
        image_url: book?.image_url ? 'present' : 'missing',
        storage_path: book?.storage_path ? 'present' : 'missing',
        video_url: book?.video_url ? 'present' : 'missing',
      });

      // Get AI text for Instagram
      if (!postCaption) {
        postCaption = book.ai_generated_text || '';
        
        // If no AI text, create basic caption
        if (!postCaption) {
          const price = book.promotional_price || book.sale_price;
          postCaption = `📚 ${book.title}`;
          if (book.author) postCaption += `\n✍️ ${book.author}`;
          if (price) postCaption += `\n💰 ${price} zł`;
          if (book.product_url) postCaption += `\n\n🔗 Link w bio`;
        }
      }

      // Get media URL - check for video first
      if (!finalVideoUrl && !finalImageUrl) {
        // Check if book has video
        if (book.video_url && isVideoUrl(book.video_url)) {
          finalVideoUrl = book.video_url;
          console.log('Using book.video_url:', finalVideoUrl);
        } else if (book.image_url) {
          // Check if image_url is actually a video
          if (isVideoUrl(book.image_url)) {
            finalVideoUrl = book.image_url;
            console.log('Using book.image_url as video:', finalVideoUrl);
          } else {
            finalImageUrl = book.image_url;
            console.log('Using book.image_url:', finalImageUrl);
          }
        } else if (book.storage_path) {
          finalImageUrl = getStoragePublicUrl(book.storage_path);
          console.log('Using storage_path URL:', finalImageUrl);
        }
      }
    }

    // If campaignPostId provided, get campaign post data
    if (campaignPostId) {
      console.log('Fetching campaign post data for campaignPostId:', campaignPostId);
      const { data: campaignPost, error: campaignError } = await supabase
        .from('campaign_posts')
        .select('*, book:books(*)')
        .eq('id', campaignPostId)
        .single();

      if (campaignError) {
        console.error('Error fetching campaign post:', campaignError);
        throw new Error('Nie znaleziono posta kampanii');
      }

      postCaption = campaignPost.text;
      
      // Check custom_image_url first (from simple campaign)
      if (campaignPost.custom_image_url) {
        if (isVideoUrl(campaignPost.custom_image_url)) {
          finalVideoUrl = campaignPost.custom_image_url;
          console.log('Using custom_image_url as video:', finalVideoUrl);
        } else if (!finalImageUrl) {
          finalImageUrl = campaignPost.custom_image_url;
          console.log('Using custom_image_url as image:', finalImageUrl);
        }
      }
      
      // Get media from book if not already set
      if (campaignPost.book && !finalVideoUrl && !finalImageUrl) {
        if (campaignPost.book.video_url && isVideoUrl(campaignPost.book.video_url)) {
          finalVideoUrl = campaignPost.book.video_url;
        } else if (campaignPost.book.image_url) {
          if (isVideoUrl(campaignPost.book.image_url)) {
            finalVideoUrl = campaignPost.book.image_url;
          } else {
            finalImageUrl = campaignPost.book.image_url;
          }
        } else if (campaignPost.book.storage_path) {
          finalImageUrl = getStoragePublicUrl(campaignPost.book.storage_path);
        }
      }
    }

    // Determine if we're posting video or image
    const isVideoPost = Boolean(finalVideoUrl);
    console.log('Post type:', isVideoPost ? 'VIDEO (Reel)' : 'IMAGE');

    // Instagram REQUIRES either image or video
    if (!finalImageUrl && !finalVideoUrl) {
      throw new Error('Instagram wymaga obrazu lub wideo. Posty tylko tekstowe nie są obsługiwane.');
    }

    // Fetch AI suffix from user_settings
    let aiSuffix = '';
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('ai_suffix_instagram')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (userSettings?.ai_suffix_instagram) {
      aiSuffix = userSettings.ai_suffix_instagram;
    }

    // Add AI suffix if configured by user (no hardcoded hashtags)
    if (postCaption && aiSuffix) {
      postCaption += `\n\n${aiSuffix}`;
    }

    console.log('=== Final Publishing Data ===');
    console.log('Caption length:', postCaption?.length);
    console.log('Image URL:', finalImageUrl || 'none');
    console.log('Video URL:', finalVideoUrl || 'none');
    console.log('Is video post:', isVideoPost);

    let containerId: string;

    if (isVideoPost) {
      // VIDEO PUBLISHING (Reels)
      console.log('Creating video (Reel) container...');
      const containerParams = new URLSearchParams({
        video_url: finalVideoUrl,
        media_type: 'REELS',
        access_token: access_token,
      });

      if (postCaption) {
        containerParams.set('caption', postCaption);
      }

      // Enable sharing to Feed as well
      containerParams.set('share_to_feed', 'true');

      const containerResponse = await fetch(
        `https://graph.facebook.com/v21.0/${instagram_account_id}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: containerParams.toString(),
        }
      );

      const containerData = await containerResponse.json();

      if (containerData.error) {
        console.error('Error creating video container:', containerData.error);
        throw new Error(containerData.error.message || 'Nie udało się utworzyć kontenera wideo');
      }

      containerId = containerData.id;
      console.log('Created video container:', containerId);

      // Wait for video container - videos take longer to process
      console.log('Waiting for video container to be ready (this may take up to 2 minutes)...');
      const isReady = await waitForContainer(containerId, access_token, 60); // 60 attempts = ~2 minutes
      
      if (!isReady) {
        throw new Error('Przetwarzanie wideo przekroczyło limit czasu. Spróbuj mniejszy plik wideo.');
      }
    } else {
      // IMAGE PUBLISHING
      console.log('Creating image container...');
      const containerParams = new URLSearchParams({
        image_url: finalImageUrl,
        access_token: access_token,
      });

      if (postCaption) {
        containerParams.set('caption', postCaption);
      }

      const containerResponse = await fetch(
        `https://graph.facebook.com/v21.0/${instagram_account_id}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: containerParams.toString(),
        }
      );

      const containerData = await containerResponse.json();

      if (containerData.error) {
        console.error('Error creating image container:', containerData.error);
        throw new Error(containerData.error.message || 'Nie udało się utworzyć kontenera mediów');
      }

      containerId = containerData.id;
      console.log('Created image container:', containerId);

      // Wait for image container to be ready
      console.log('Waiting for image container to be ready...');
      const isReady = await waitForContainer(containerId, access_token);
      
      if (!isReady) {
        throw new Error('Przetwarzanie obrazu przekroczyło limit czasu');
      }
    }

    // Publish the container
    console.log('Publishing container...');
    const publishResponse = await fetch(
      `https://graph.facebook.com/v21.0/${instagram_account_id}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: containerId,
          access_token: access_token,
        }).toString(),
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      console.error('Error publishing:', publishData.error);
      throw new Error(publishData.error.message || 'Nie udało się opublikować na Instagram');
    }

    const mediaId = publishData.id;
    console.log('Published successfully! Media ID:', mediaId, 'Type:', isVideoPost ? 'Reel' : 'Image');

    // Update book_platform_content if contentId provided
    if (contentId) {
      await supabase
        .from('book_platform_content')
        .update({
          published: true,
          published_at: new Date().toISOString(),
          post_id: mediaId,
        })
        .eq('id', contentId);
    }

    // Update book status if bookId provided (legacy behavior)
    if (bookId && !contentId) {
      await supabase
        .from('books')
        .update({
          published: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mediaId,
        postId: mediaId,
        mediaType: isVideoPost ? 'reel' : 'image',
        message: `Pomyślnie opublikowano ${isVideoPost ? 'Reel' : 'post'} na Instagram`,
        results: [{ success: true, platform: 'instagram', postId: mediaId }]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('Error in publish-to-instagram:', error);
    // Return 200 with success: false so Supabase client can parse the error message
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        results: [{ success: false, platform: 'instagram', error: errorMessage }]
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
