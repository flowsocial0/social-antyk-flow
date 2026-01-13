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
    let testConnection: boolean | undefined;
    let userIdFromBody: string | undefined;

    try {
      const body = await req.json();
      bookId = body.bookId;
      contentId = body.contentId;
      campaignPostId = body.campaignPostId;
      caption = body.caption || body.text;
      imageUrl = body.imageUrl;
      testConnection = body.testConnection;
      userIdFromBody = body.userId;
      
      console.log('Request body:', { 
        bookId, 
        contentId,
        campaignPostId,
        caption: caption ? 'present' : undefined,
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
      throw new Error('Musisz być zalogowany aby publikować na Instagram');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Instagram token from database
    console.log('Fetching Instagram token for user:', userId);
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('instagram_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError) {
      console.error('Error fetching Instagram token:', tokenError);
      throw new Error('Błąd pobierania tokenu Instagram: ' + tokenError.message);
    }
    
    if (!tokenData) {
      console.error('No Instagram token found for user:', userId);
      throw new Error('Instagram nie jest połączony. Połącz konto Instagram w ustawieniach.');
    }

    const { access_token, instagram_account_id, instagram_username, expires_at } = tokenData;
    console.log('Found Instagram token:', { instagram_account_id, instagram_username, expires_at });

    // Check if token is expired
    if (expires_at && new Date(expires_at) < new Date()) {
      throw new Error('Token Instagram wygasł. Połącz ponownie konto Instagram.');
    }

    // If it's just a connection test, return success
    const isTest = Boolean(testConnection) || (!bookId && !contentId && !campaignPostId && !caption);
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
      });

      // Get AI text for Instagram (use ai_generated_text as fallback since we don't have ai_text_instagram yet)
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

      // Get image URL
      if (!finalImageUrl) {
        if (book.image_url) {
          finalImageUrl = book.image_url;
          console.log('Using book.image_url:', finalImageUrl);
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
      
      // Get image from book if available
      if (campaignPost.book && !finalImageUrl) {
        if (campaignPost.book.image_url) {
          finalImageUrl = campaignPost.book.image_url;
        } else if (campaignPost.book.storage_path) {
          finalImageUrl = getStoragePublicUrl(campaignPost.book.storage_path);
        }
      }
    }

    // Instagram REQUIRES an image
    if (!finalImageUrl) {
      throw new Error('Instagram wymaga obrazu. Posty tylko tekstowe nie są obsługiwane. Dodaj obraz do książki.');
    }

    // Add AI disclaimer
    if (postCaption) {
      postCaption += '\n\n#książki #antykwariat';
      postCaption += '\n\nTekst wygenerowany przez AI';
    }

    console.log('=== Final Publishing Data ===');
    console.log('Caption length:', postCaption?.length);
    console.log('Image URL:', finalImageUrl);

    // Step 1: Create media container
    console.log('Creating media container...');
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
      console.error('Error creating container:', containerData.error);
      throw new Error(containerData.error.message || 'Nie udało się utworzyć kontenera mediów');
    }

    const containerId = containerData.id;
    console.log('Created container:', containerId);

    // Step 2: Wait for container to be ready
    console.log('Waiting for container to be ready...');
    const isReady = await waitForContainer(containerId, access_token);
    
    if (!isReady) {
      throw new Error('Przetwarzanie kontenera przekroczyło limit czasu');
    }

    // Step 3: Publish the container
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
    console.log('Published successfully! Media ID:', mediaId);

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
        message: 'Pomyślnie opublikowano na Instagram',
        results: [{ success: true, platform: 'instagram', postId: mediaId }]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('Error in publish-to-instagram:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        results: [{ success: false, platform: 'instagram', error: errorMessage }]
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
