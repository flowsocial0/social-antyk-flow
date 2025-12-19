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

// Download video and return as ArrayBuffer with content type
async function downloadVideo(videoUrl: string): Promise<{ data: ArrayBuffer; contentType: string; size: number }> {
  console.log('Downloading video from:', videoUrl);
  
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }
  
  const contentType = response.headers.get('content-type') || 'video/mp4';
  const data = await response.arrayBuffer();
  
  console.log('Video downloaded:', { size: data.byteLength, contentType });
  return { data, contentType, size: data.byteLength };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Publish to TikTok (VIDEO) Request ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let userId: string | null = null;

    const body = await req.json();
    const { 
      contentId, 
      bookId, 
      platform, 
      testConnection,
      userId: userIdFromBody,
      videoUrl: videoUrlFromBody
    } = body;

    console.log('Request body:', { contentId, bookId, platform, testConnection, hasVideoUrl: !!videoUrlFromBody });

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabaseClient.auth.getUser();
      userId = user?.id ?? null;
    }

    if (!userId && userIdFromBody) {
      userId = userIdFromBody;
    }

    if (!userId) {
      throw new Error('User authentication required');
    }

    console.log('User ID:', userId);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: tokenData, error: tokenError } = await supabase
      .from('tiktok_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Token fetch error:', tokenError);
      throw new Error('TikTok nie jest połączony. Przejdź do ustawień kont społecznościowych.');
    }

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

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log('Token expired, refreshing...');
      if (!tokenData.refresh_token) {
        throw new Error('Token wygasł i brak refresh tokena. Połącz konto ponownie.');
      }
      accessToken = await refreshAccessToken(supabase, userId, tokenData.refresh_token);
    }

    let bookData: any = null;
    let contentData: any = null;
    let textToPost: string = '';
    let videoUrl: string | null = videoUrlFromBody || null;

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
      
      // Check if there's a video URL in media_urls
      if (contentData.media_urls && contentData.media_urls.length > 0) {
        const mediaUrl = contentData.media_urls[0];
        if (mediaUrl.includes('.mp4') || mediaUrl.includes('video')) {
          videoUrl = mediaUrl;
        }
      }
    }

    textToPost = contentData?.custom_text || contentData?.ai_generated_text || bookData?.ai_generated_text || bookData?.title || 'Nowy post';

    console.log('Publishing VIDEO to TikTok:', { 
      textLength: textToPost.length, 
      hasVideo: !!videoUrl 
    });

    if (!videoUrl) {
      throw new Error('TikTok wymaga wideo do publikacji. Dodaj wideo do treści (media_urls) lub przekaż videoUrl.');
    }

    // Download the video first
    const videoData = await downloadVideo(videoUrl);
    
    // Check video size - TikTok has limits
    const videoSizeMB = videoData.size / (1024 * 1024);
    console.log('Video size:', videoSizeMB.toFixed(2), 'MB');
    
    if (videoSizeMB > 128) {
      throw new Error('Wideo jest za duże. Maksymalny rozmiar to 128MB.');
    }

    // TikTok Video Upload - FILE_UPLOAD method
    // Step 1: Initialize video upload
    const initEndpoint = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
    
    const initBody = {
      post_info: {
        title: textToPost.substring(0, 150),
        privacy_level: 'SELF_ONLY', // Start with SELF_ONLY (always available)
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoData.size,
        chunk_size: videoData.size, // Single chunk for smaller videos
        total_chunk_count: 1,
      },
    };

    console.log('TikTok video init request:', JSON.stringify(initBody, null, 2));

    const initResponse = await fetch(initEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(initBody),
    });

    const initData = await initResponse.json();
    console.log('TikTok video init response:', JSON.stringify(initData, null, 2));

    if (initData.error?.code) {
      const errorCode = initData.error.code;
      const errorMsg = initData.error.message || errorCode;
      
      if (errorCode === 'spam_risk_too_many_pending_share') {
        throw new Error('Za dużo oczekujących postów. Poczekaj chwilę i spróbuj ponownie.');
      }
      
      throw new Error(`TikTok error: ${errorMsg}`);
    }

    const publishId = initData.data?.publish_id;
    const uploadUrl = initData.data?.upload_url;
    
    if (!publishId || !uploadUrl) {
      console.error('Missing publish_id or upload_url in response:', initData);
      throw new Error('Nie udało się uzyskać URL uploadu z TikTok');
    }

    // Step 2: Upload the video
    console.log('Uploading video to TikTok...');
    console.log('Upload URL:', uploadUrl);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoData.size.toString(),
        'Content-Range': `bytes 0-${videoData.size - 1}/${videoData.size}`,
      },
      body: videoData.data,
    });
    
    console.log('Video upload response status:', uploadResponse.status);
    
    if (!uploadResponse.ok && uploadResponse.status !== 201) {
      const errorText = await uploadResponse.text();
      console.error('Video upload failed:', uploadResponse.status, errorText);
      throw new Error(`Błąd uploadu wideo: ${uploadResponse.status}`);
    }

    console.log('Video uploaded successfully, publish_id:', publishId);

    // Step 3: Check publish status (optional, but good for debugging)
    // TikTok processes the video asynchronously
    
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
        message: 'Wideo wysłane do TikTok! Przetwarzanie może potrwać kilka minut.',
        note: 'Post jest ustawiony jako prywatny (SELF_ONLY). Możesz zmienić widoczność w aplikacji TikTok.'
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
