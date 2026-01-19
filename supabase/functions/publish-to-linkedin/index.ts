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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request body
    const body = await req.json();
    const { text, imageUrl, userId, accountId, bookId, contentId } = body;

    console.log('Publish request:', {
      textLength: text?.length || 0,
      hasImage: !!imageUrl,
      userId: userId ? 'present' : 'missing',
      accountId: accountId || 'not specified',
      bookId: bookId || 'not specified',
      contentId: contentId || 'not specified'
    });

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Determine post text and image
    let postText = text;
    let finalImageUrl = imageUrl;

    // If bookId is provided, fetch book data and use AI text
    if (bookId) {
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

    // Get LinkedIn token for user
    let tokenQuery = supabase
      .from('linkedin_oauth_tokens')
      .select('*')
      .eq('user_id', userId);

    if (accountId) {
      tokenQuery = tokenQuery.eq('id', accountId);
    } else {
      tokenQuery = tokenQuery.eq('is_default', true);
    }

    const { data: tokenData, error: tokenError } = await tokenQuery.single();

    if (tokenError || !tokenData) {
      console.error('No LinkedIn token found:', tokenError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Brak połączonego konta LinkedIn',
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

    // Build the LinkedIn post
    let mediaAssets: string[] = [];

    // If there's an image, we need to upload it first
    if (finalImageUrl) {
      console.log('Uploading image to LinkedIn...');
      
      // Step 1: Register the image upload
      const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
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
        // Step 2: Download the image
        const imageResponse = await fetch(finalImageUrl);
        if (!imageResponse.ok) {
          throw new Error('Failed to fetch image from URL');
        }
        const imageBlob = await imageResponse.blob();

        // Step 3: Upload the image to LinkedIn
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: imageBlob
        });

        if (!uploadResponse.ok) {
          console.error('LinkedIn image upload failed:', uploadResponse.status);
          throw new Error('Failed to upload image to LinkedIn');
        }

        mediaAssets.push(asset);
        console.log('Image uploaded successfully:', asset);
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
          shareMediaCategory: mediaAssets.length > 0 ? 'IMAGE' : 'NONE',
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
