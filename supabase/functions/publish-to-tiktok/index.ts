import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(supabase: any, userId: string, refreshToken: string): Promise<string> {
  const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')!;
  const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET')!;

  console.log('Refreshing TikTok access token...');

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }

  // Update token in database
  await supabase
    .from('tiktok_oauth_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  console.log('Token refreshed successfully');
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Publish to TikTok Request ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let userId: string | null = null;

    // Parse request body
    const body = await req.json();
    const { 
      contentId, 
      bookId, 
      platform, 
      testConnection,
      userId: userIdFromBody 
    } = body;

    console.log('Request body:', { contentId, bookId, platform, testConnection });

    // Get user from Authorization header or from body (for auto-publish)
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabaseClient.auth.getUser();
      userId = user?.id ?? null;
    }

    // Allow userId from body for server-to-server calls (auto-publish)
    if (!userId && userIdFromBody) {
      userId = userIdFromBody;
    }

    if (!userId) {
      throw new Error('User authentication required');
    }

    console.log('User ID:', userId);

    // Create service client for database operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get TikTok token
    const { data: tokenData, error: tokenError } = await supabase
      .from('tiktok_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Token fetch error:', tokenError);
      throw new Error('TikTok nie jest połączony. Przejdź do ustawień kont społecznościowych.');
    }

    // Handle test connection request
    if (testConnection) {
      console.log('Testing TikTok connection...');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'TikTok połączony pomyślnie',
          openId: tokenData.open_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = tokenData.access_token;

    // Check if token is expired and refresh if needed
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log('Token expired, refreshing...');
      if (!tokenData.refresh_token) {
        throw new Error('Token wygasł i brak refresh tokena. Połącz konto ponownie.');
      }
      accessToken = await refreshAccessToken(supabase, userId, tokenData.refresh_token);
    }

    // Get book data if bookId provided
    let bookData: any = null;
    let contentData: any = null;
    let textToPost: string = '';
    let imageUrl: string | null = null;

    if (bookId) {
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookError) {
        console.error('Book fetch error:', bookError);
        throw new Error('Nie znaleziono książki');
      }
      bookData = book;
      console.log('Book data:', { title: bookData.title, hasImage: !!bookData.image_url });
    }

    if (contentId) {
      const { data: content, error: contentError } = await supabase
        .from('book_platform_content')
        .select('*')
        .eq('id', contentId)
        .single();

      if (contentError) {
        console.error('Content fetch error:', contentError);
        throw new Error('Nie znaleziono treści do publikacji');
      }
      contentData = content;
      console.log('Content data:', { hasCustomText: !!contentData.custom_text, hasAiText: !!contentData.ai_generated_text });
    }

    // Determine text and image
    textToPost = contentData?.custom_text || contentData?.ai_generated_text || bookData?.ai_generated_text || bookData?.title || 'Nowy post';
    imageUrl = bookData?.image_url || null;

    // If we have storage_path, construct the full URL
    if (bookData?.storage_path) {
      const { data: urlData } = supabase.storage
        .from('ObrazkiKsiazek')
        .getPublicUrl(bookData.storage_path);
      if (urlData?.publicUrl) {
        imageUrl = urlData.publicUrl;
      }
    }

    console.log('Publishing to TikTok:', { 
      textLength: textToPost.length, 
      hasImage: !!imageUrl 
    });

    if (!imageUrl) {
      throw new Error('TikTok wymaga obrazu lub wideo do publikacji. Dodaj obraz do książki.');
    }

    // TikTok Photo Post via Content Posting API
    // NOTE: Domain must be verified in TikTok Developer Console for PULL_FROM_URL
    // privacy_level options depend on app approval:
    // - SELF_ONLY: Only visible to creator (always available)
    // - PUBLIC_TO_EVERYONE: Public (requires app approval)
    
    const initEndpoint = 'https://open.tiktokapis.com/v2/post/publish/content/init/';
    
    // Simplified post_info for photo posts - only essential fields
    const initBody = {
      post_info: {
        title: textToPost.substring(0, 150),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: [imageUrl],
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    };

    console.log('TikTok init request:', JSON.stringify(initBody, null, 2));

    const initResponse = await fetch(initEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(initBody),
    });

    const initData = await initResponse.json();
    console.log('TikTok init response:', JSON.stringify(initData, null, 2));

    // Handle TikTok API errors
    if (initData.error?.code) {
      const errorCode = initData.error.code;
      const errorMsg = initData.error.message || errorCode;
      
      // Common error handling
      if (errorCode === 'spam_risk_too_many_pending_share') {
        throw new Error('Za dużo oczekujących postów. Poczekaj chwilę i spróbuj ponownie.');
      }
      if (errorCode === 'invalid_param' && errorMsg.includes('privacy_level')) {
        // Try with SELF_ONLY if PUBLIC not approved
        console.log('Retrying with SELF_ONLY privacy...');
        initBody.post_info.privacy_level = 'SELF_ONLY';
        
        const retryResponse = await fetch(initEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify(initBody),
        });
        
        const retryData = await retryResponse.json();
        console.log('TikTok retry response:', JSON.stringify(retryData, null, 2));
        
        if (retryData.error?.code) {
          throw new Error(`TikTok error: ${retryData.error.message || retryData.error.code}`);
        }
        
        if (retryData.data?.publish_id) {
          // Update content as published
          if (contentId) {
            await supabase
              .from('book_platform_content')
              .update({
                published: true,
                published_at: new Date().toISOString(),
                post_id: retryData.data.publish_id,
              })
              .eq('id', contentId);
          }
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              publishId: retryData.data.publish_id,
              message: 'Post wysłany jako prywatny (wymaga zatwierdzenia aplikacji dla publicznych postów)',
              warning: 'Post jest widoczny tylko dla Ciebie. Aplikacja wymaga zatwierdzenia TikTok dla publicznych postów.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      throw new Error(`TikTok error: ${errorMsg}`);
    }

    const publishId = initData.data?.publish_id;
    
    if (!publishId) {
      console.error('No publish_id in response:', initData);
      throw new Error('Nie udało się uzyskać ID publikacji z TikTok');
    }

    console.log('TikTok publish initiated, publish_id:', publishId);

    // Update content as published
    if (contentId) {
      await supabase
        .from('book_platform_content')
        .update({
          published: true,
          published_at: new Date().toISOString(),
          post_id: publishId,
        })
        .eq('id', contentId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        publishId,
        message: 'Post opublikowany na TikTok'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Publish to TikTok error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
