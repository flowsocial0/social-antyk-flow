import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Publish to LinkedIn ===');
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request body
    const body = await req.json();
    const { text, imageUrl, userId: userIdFromBody, accountId, bookId, contentId, testConnection, campaignPostId } = body;

    // Determine userId - from body (auto-publish) or from JWT (direct user call)
    let userId: string | null = null;

    if (userIdFromBody) {
      userId = userIdFromBody;
      console.log('Using userId from request body:', userId);
    } else {
      // Get user_id from Authorization header
      const authHeader = req.headers.get('authorization');
      console.log('Authorization header:', authHeader ? 'present' : 'MISSING');
      
      if (authHeader && SUPABASE_ANON_KEY) {
        const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
        
        if (!userError && user) {
          userId = user.id;
          console.log('User ID from JWT:', userId);
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Musisz być zalogowany aby publikować na LinkedIn',
          errorCode: 'NO_USER_ID'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Handle test connection request
    if (testConnection) {
      console.log('Testing LinkedIn connection...');
      
      // Get all LinkedIn tokens for user
      const { data: tokens, error: tokensError } = await supabase
        .from('linkedin_oauth_tokens')
        .select('id, display_name, linkedin_id, expires_at, access_token')
        .eq('user_id', userId);
      
      if (tokensError || !tokens || tokens.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            connected: false,
            message: 'Brak połączonych kont LinkedIn'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // Test first token by calling LinkedIn userinfo endpoint
      const testToken = tokens[0];
      try {
        const testResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${testToken.access_token}` }
        });
        
        if (testResponse.ok) {
          const userData = await testResponse.json();
          return new Response(
            JSON.stringify({
              success: true,
              connected: true,
              accountCount: tokens.length,
              name: userData.name || testToken.display_name,
              accounts: tokens.map((t: any) => ({ id: t.id, name: t.display_name }))
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        } else {
          // Token expired or invalid
          return new Response(
            JSON.stringify({
              success: false,
              connected: false,
              message: 'Token LinkedIn wygasł. Połącz konto ponownie.',
              expired: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            connected: false,
            message: 'Błąd podczas testowania połączenia z LinkedIn'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // Determine post text and image
    let postText = text;
    let finalImageUrl = imageUrl;

    // Handle campaign post publishing (from auto-publish-books)
    if (campaignPostId) {
      console.log('Publishing campaign post:', campaignPostId);
      
      const { data: campaignPost, error: postError } = await supabase
        .from('campaign_posts')
        .select('text, custom_image_url, book_id')
        .eq('id', campaignPostId)
        .single();
      
      if (postError || !campaignPost) {
        console.error('Campaign post fetch error:', postError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Nie znaleziono posta kampanii',
            errorCode: 'POST_NOT_FOUND'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Use campaign post text
      postText = campaignPost.text;
      
      // Use custom_image_url from campaign post if available
      if (campaignPost.custom_image_url) {
        finalImageUrl = campaignPost.custom_image_url;
      }
      
      // If post has book_id, get book image as fallback
      if (!finalImageUrl && campaignPost.book_id) {
        const { data: bookData } = await supabase
          .from('books')
          .select('image_url, storage_path')
          .eq('id', campaignPost.book_id)
          .single();
        
        if (bookData) {
          if (bookData.storage_path) {
            finalImageUrl = `${SUPABASE_URL}/storage/v1/object/public/ObrazkiKsiazek/${bookData.storage_path}`;
          } else if (bookData.image_url) {
            finalImageUrl = bookData.image_url;
          }
        }
      }

      console.log('Campaign post data loaded:', {
        hasText: !!postText,
        textLength: postText?.length || 0,
        hasImage: !!finalImageUrl
      });
    }

    // If bookId is provided AND not already handled by campaignPostId, fetch book data
    if (bookId && !campaignPostId) {
      console.log('Fetching book data for bookId:', bookId);
      
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookError || !book) {
        console.error('Book fetch error:', bookError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Nie znaleziono książki',
            errorCode: 'BOOK_NOT_FOUND'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Use LinkedIn-specific AI text, fallback to generic
      postText = book.ai_text_linkedin || book.ai_generated_text;
      
      // If no AI text, create default text from book data
      if (!postText) {
        const price = book.promotional_price || book.sale_price;
        postText = `📚 ${book.title}${book.author ? ` - ${book.author}` : ''}`;
        if (book.description) {
          postText += `\n\n${book.description.substring(0, 500)}`;
        }
        if (price) {
          postText += `\n\n💰 Cena: ${price} zł`;
        }
      }
      
      // Add product URL if not already present
      if (book.product_url && !postText.includes(book.product_url)) {
        postText += `\n\n🔗 ${book.product_url}`;
      }

      // Get image from book if not provided
      if (!finalImageUrl) {
        if (book.storage_path) {
          finalImageUrl = `${SUPABASE_URL}/storage/v1/object/public/ObrazkiKsiazek/${book.storage_path}`;
        } else if (book.image_url) {
          finalImageUrl = book.image_url;
        }
      }

      console.log('Book data loaded:', {
        title: book.title,
        hasAiText: !!book.ai_text_linkedin,
        hasGenericAiText: !!book.ai_generated_text,
        postTextLength: postText?.length || 0,
        hasImage: !!finalImageUrl
      });
    }

    // Validate - require text
    if (!postText) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Brak tekstu do publikacji. Wygeneruj tekst AI lub dodaj opis książki.',
          errorCode: 'NO_TEXT'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get LinkedIn token for user - with fallback if no accountId provided
    let tokenQuery = supabase
      .from('linkedin_oauth_tokens')
      .select('*')
      .eq('user_id', userId);

    if (accountId) {
      tokenQuery = tokenQuery.eq('id', accountId);
    } else {
      // Fallback: get first account (or default if exists)
      tokenQuery = tokenQuery.order('is_default', { ascending: false }).limit(1);
      console.log('No accountId provided, using fallback to first/default account');
    }

    const { data: tokenData, error: tokenError } = await tokenQuery.maybeSingle();

    if (tokenError || !tokenData) {
      console.error('No LinkedIn token found:', tokenError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Konto LinkedIn (${accountId}) nie znalezione lub nie połączone`,
          errorCode: 'NO_LINKEDIN_TOKEN'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const accessToken = tokenData.access_token;
    const linkedinId = tokenData.linkedin_id;

    console.log('Using LinkedIn account:', tokenData.display_name);

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.error('LinkedIn token expired');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Token LinkedIn wygasł. Połącz konto ponownie.',
          errorCode: 'TOKEN_EXPIRED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Helper to detect video URLs
    const isVideoUrl = (url: string): boolean => /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(url);

    // Build the LinkedIn post
    let mediaAssets: string[] = [];
    let isVideoMedia = false;

    // If there's media, we need to upload it first
    if (finalImageUrl) {
      const isVideo = isVideoUrl(finalImageUrl);
      isVideoMedia = isVideo;
      console.log(`Uploading ${isVideo ? 'video' : 'image'} to LinkedIn...`);
      
      // Step 1: Register the upload with appropriate recipe
      const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: [isVideo 
              ? 'urn:li:digitalmediaRecipe:feedshare-video'
              : 'urn:li:digitalmediaRecipe:feedshare-image'
            ],
            owner: `urn:li:person:${linkedinId}`,
            serviceRelationships: [{
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent'
            }]
          }
        })
      });

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json();
        console.error('LinkedIn register upload error:', errorData);
        throw new Error('Failed to register image upload with LinkedIn');
      }

      const registerData = await registerResponse.json();
      const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
      const asset = registerData.value?.asset;

      if (uploadUrl && asset) {
        // Step 2: Download the media
        const mediaResponse = await fetch(finalImageUrl);
        if (!mediaResponse.ok) {
          throw new Error('Failed to fetch media from URL');
        }
        const mediaBlob = await mediaResponse.blob();

        // Step 3: Upload the media to LinkedIn
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: mediaBlob
        });

        if (!uploadResponse.ok) {
          console.error('LinkedIn media upload failed:', uploadResponse.status);
          throw new Error('Failed to upload media to LinkedIn');
        }

        // Step 3b: For video, wait for LinkedIn to process it
        if (isVideo) {
          console.log('Waiting for LinkedIn video processing...');
          let assetReady = false;
          const maxChecks = 20; // ~60 seconds max (20 * 3s)
          for (let i = 0; i < maxChecks; i++) {
            try {
              const statusResponse = await fetch(
                `https://api.linkedin.com/v2/assets/${encodeURIComponent(asset)}`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
              );
              
              if (!statusResponse.ok) {
                console.error(`Asset status check failed with HTTP ${statusResponse.status}`);
                // If we can't check status after upload, assume it's ready after a delay
                if (i >= 5) {
                  console.log('Cannot verify video status, proceeding with post after delay');
                  assetReady = true;
                  break;
                }
                await new Promise(r => setTimeout(r, 3000));
                continue;
              }
              
              const statusData = await statusResponse.json();
              
              // LinkedIn API may return status in different paths
              const recipeStatus = statusData.recipes?.[0]?.status;
              const serviceStatus = statusData.serviceRelationships?.[0]?.status;
              const mediaStatus = statusData.mediaTypeFamily;
              const effectiveStatus = recipeStatus || serviceStatus;
              
              console.log(`Video processing check ${i + 1}/${maxChecks}: recipe=${recipeStatus}, service=${serviceStatus}, mediaType=${mediaStatus}`);
              
              if (effectiveStatus === 'AVAILABLE' || recipeStatus === 'AVAILABLE') {
                assetReady = true;
                break;
              }
              if (effectiveStatus === 'PROCESSING_FAILED' || recipeStatus === 'PROCESSING_FAILED') {
                throw new Error('LinkedIn nie mógł przetworzyć wideo. Sprawdź format pliku.');
              }
              
              // If status is undefined after multiple checks, the upload may already be ready
              if (!effectiveStatus && i >= 8) {
                console.log('Video status remains undefined after multiple checks, assuming ready');
                assetReady = true;
                break;
              }
            } catch (statusError) {
              if (statusError instanceof Error && statusError.message.includes('przetworzyć')) {
                throw statusError; // Re-throw processing failed error
              }
              console.error(`Status check ${i + 1} error:`, statusError);
              if (i >= 8) {
                console.log('Multiple status check failures, proceeding with post attempt');
                assetReady = true;
                break;
              }
            }
            await new Promise(r => setTimeout(r, 3000));
          }
          if (!assetReady) {
            throw new Error('Przetwarzanie wideo LinkedIn przekroczyło limit czasu (60 sekund)');
          }
          console.log('Video processing complete!');
        }

        mediaAssets.push(asset);
        console.log(`${isVideo ? 'Video' : 'Image'} uploaded successfully:`, asset);
      }
    }

    // Step 4: Create the post
    const postBody: any = {
      author: `urn:li:person:${linkedinId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: postText
          },
          shareMediaCategory: mediaAssets.length > 0 ? (isVideoMedia ? 'VIDEO' : 'IMAGE') : 'NONE',
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    // Add media if present
    if (mediaAssets.length > 0) {
      postBody.specificContent['com.linkedin.ugc.ShareContent'].media = mediaAssets.map(asset => ({
        status: 'READY',
        media: asset
      }));
    }

    console.log('Creating LinkedIn post...');

    const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postBody)
    });

    if (!postResponse.ok) {
      const errorData = await postResponse.json();
      console.error('LinkedIn post error:', errorData);
      
      // Check for specific errors
      if (postResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Token LinkedIn wygasł. Połącz konto ponownie.',
            errorCode: 'TOKEN_EXPIRED'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      throw new Error(errorData.message || 'Failed to create LinkedIn post');
    }

    const postId = postResponse.headers.get('x-restli-id') || 'unknown';
    console.log('LinkedIn post created successfully, ID:', postId);

    // Record the publication
    await supabase
      .from('platform_publications')
      .insert({
        user_id: userId,
        platform: 'linkedin',
        account_id: tokenData.id,
        post_id: postId,
        published_at: new Date().toISOString(),
        source: bookId ? 'book' : 'manual',
        book_id: bookId || null,
      });

    // Update book_platform_content if contentId or bookId provided
    if (contentId || bookId) {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('book_platform_content')
        .upsert({
          id: contentId && !contentId.startsWith('temp-') ? contentId : undefined,
          book_id: bookId,
          platform: 'linkedin',
          user_id: userId,
          published: true,
          published_at: new Date().toISOString(),
          post_id: postId,
        }, { 
          onConflict: 'book_id,platform,user_id',
          ignoreDuplicates: false 
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        postId,
        message: 'Post opublikowany na LinkedIn'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Publish to LinkedIn error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: errorMessage,
        errorCode: 'PUBLISH_FAILED'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
