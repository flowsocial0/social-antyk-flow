import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function makeError(message: string, code: string): Error {
  const err = new Error(message);
  (err as any).code = code;
  return err;
}

async function refreshAccessToken(supabase: any, tokenId: string, refreshToken: string): Promise<string> {
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
  console.log('TikTok refresh response status:', response.status);
  
  if (!response.ok || data.error) {
    throw makeError(`Nie udało się odświeżyć tokenu TikTok: ${data.error_description || data.error || response.statusText}`, 'TOKEN_REFRESH_FAILED');
  }

  await supabase
    .from('tiktok_oauth_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tokenId);

  console.log('Token refreshed successfully');
  return data.access_token;
}

async function queryCreatorInfo(accessToken: string): Promise<any | null> {
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({}),
  });

  const data = await response.json();
  console.log('TikTok creator info response:', JSON.stringify(data, null, 2));

  if (!response.ok || (data.error?.code && data.error.code !== 'ok')) {
    console.warn('TikTok creator info query failed:', response.status, JSON.stringify(data));
    return null;
  }

  return data.data || null;
}

function pickPrivacyLevel(creatorInfo: any): string {
  const options = creatorInfo?.privacy_level_options;
  if (!Array.isArray(options) || options.length === 0) return 'SELF_ONLY';
  return options.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : options[0];
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
  
  // Validate that we actually got a video file, not an HTML page
  if (contentType.includes('text/html') || contentType.includes('text/plain')) {
    throw new Error(
      'Podany link nie zwraca bezpośrednio pliku wideo (otrzymano HTML). ' +
      'Serwisy jak Mega, Google Drive, Dropbox wymagają specjalnych linków do bezpośredniego pobierania. ' +
      'Użyj bezpośredniego linku do pliku .mp4.'
    );
  }
  
  // Also check if the file is suspiciously small (< 10KB is likely not a real video)
  if (data.byteLength < 10240) {
    throw new Error(
      `Pobrane dane są zbyt małe (${data.byteLength} bajtów), prawdopodobnie to nie jest plik wideo. ` +
      'Sprawdź czy link prowadzi bezpośrednio do pliku wideo.'
    );
  }
  
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
      videoUrl: videoUrlFromBody,
      accountId, // For multi-account support
      privacyLevelOverride, // Diagnostic: force a specific privacy level
    } = body;

    // Fingerprint client key for diagnostics (no secret leak)
    const clientKeyEnv = Deno.env.get('TIKTOK_CLIENT_KEY') || '';
    const clientKeyFingerprint = clientKeyEnv
      ? `${clientKeyEnv.substring(0, 4)}…${clientKeyEnv.slice(-4)} (len=${clientKeyEnv.length})`
      : 'MISSING';
    console.log('TikTok client key fingerprint:', clientKeyFingerprint);

    console.log('Request body:', { contentId, bookId, platform, testConnection, hasVideoUrl: !!videoUrlFromBody, accountId, privacyLevelOverride });

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

    // Get TikTok tokens (multi-account support)
    let tokenQuery = supabase
      .from('tiktok_oauth_tokens')
      .select('*')
      .eq('user_id', userId);

    if (accountId) {
      tokenQuery = tokenQuery.eq('id', accountId);
    } else {
      tokenQuery = tokenQuery.eq('is_default', true);
    }

    let { data: tokenData, error: tokenError } = await tokenQuery.maybeSingle();

    // Fallback: if no default account found and no specific account requested, get any account
    if (!tokenData && !accountId) {
      console.log('No default TikTok account found, fetching any available account...');
      const { data: anyToken } = await supabase
        .from('tiktok_oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      tokenData = anyToken;
    }

    if (!tokenData) {
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
      accessToken = await refreshAccessToken(supabase, tokenData.id, tokenData.refresh_token);
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
      console.log('Book data:', { title: bookData.title, hasImage: !!bookData.image_url, hasVideo: !!(bookData as any).video_url });
      
      // Only use book's video_url if no videoUrl was explicitly passed in the request
      if (!videoUrl && (bookData as any).video_url) {
        videoUrl = (bookData as any).video_url;
        console.log('Using video from book.video_url:', videoUrl);
      } else if (videoUrl) {
        console.log('Using video from request body (resolved URL):', videoUrl);
      }
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
      
      // Check if there's a video URL in media_urls (overrides book's video_url if present)
      if (contentData.media_urls && contentData.media_urls.length > 0) {
        const mediaUrl = contentData.media_urls[0];
        if (mediaUrl.includes('.mp4') || mediaUrl.includes('video')) {
          videoUrl = mediaUrl;
          console.log('Using video from content.media_urls:', videoUrl);
        }
      }
    }

    textToPost = contentData?.custom_text || contentData?.ai_generated_text || bookData?.ai_generated_text || bookData?.title || 'Nowy post';

    // Fetch AI suffix from user_settings
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('ai_suffix_tiktok')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (userSettings?.ai_suffix_tiktok && textToPost) {
      textToPost += ` ${userSettings.ai_suffix_tiktok}`;
    }

    console.log('Publishing VIDEO to TikTok:', { 
      textLength: textToPost.length, 
      hasVideo: !!videoUrl 
    });

    if (!videoUrl) {
      throw new Error('TikTok wymaga wideo do publikacji. Dodaj URL wideo do książki lub przekaż videoUrl w żądaniu.');
    }

    // Download the video first
    const videoData = await downloadVideo(videoUrl);
    
    // Check video size - TikTok has limits
    const videoSizeMB = videoData.size / (1024 * 1024);
    console.log('Video size:', videoSizeMB.toFixed(2), 'MB');
    
    if (videoSizeMB > 128) {
      throw new Error('Wideo jest za duże. Maksymalny rozmiar to 128MB.');
    }

    const creatorInfo = await queryCreatorInfo(accessToken);
    let privacyLevel = privacyLevelOverride || pickPrivacyLevel(creatorInfo);
    console.log('Initial TikTok privacy level:', privacyLevel, privacyLevelOverride ? '(override)' : '');

    // TikTok Video Upload - FILE_UPLOAD method
    const initEndpoint = 'https://open.tiktokapis.com/v2/post/publish/video/init/';

    const buildInitBody = (level: string) => ({
      post_info: {
        title: textToPost.substring(0, 150),
        privacy_level: level,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoData.size,
        chunk_size: videoData.size,
        total_chunk_count: 1,
      },
    });

    const callInit = async (level: string) => {
      const reqBody = buildInitBody(level);
      console.log(`TikTok video init request (privacy=${level}):`, JSON.stringify(reqBody));
      const resp = await fetch(initEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(reqBody),
      });
      const json = await resp.json();
      console.log(`TikTok video init response (privacy=${level}):`, JSON.stringify(json));
      return json;
    };

    let initData = await callInit(privacyLevel);
    let usedFallback = false;

    // Fallback: if app is unaudited and we tried a public level, retry with SELF_ONLY
    if (
      initData?.error?.code === 'unaudited_client_can_only_post_to_private_accounts' &&
      privacyLevel !== 'SELF_ONLY' &&
      !privacyLevelOverride
    ) {
      console.warn('TikTok rejected public post (unaudited client). Retrying with SELF_ONLY fallback…');
      privacyLevel = 'SELF_ONLY';
      usedFallback = true;
      initData = await callInit(privacyLevel);
    }

    if (initData.error?.code && initData.error.code !== 'ok') {
      const errorCode = initData.error.code;
      const errorMsg = initData.error.message || errorCode;
      const logId = initData.error.log_id || 'n/a';

      if (errorCode === 'spam_risk_too_many_pending_share') {
        throw makeError('Za dużo oczekujących postów. Poczekaj chwilę i spróbuj ponownie.', 'TIKTOK_TOO_MANY_PENDING');
      }

      if (errorCode === 'unaudited_client_can_only_post_to_private_accounts') {
        throw makeError(
          `TikTok odrzuca Direct Post dla tej aplikacji: status Live nie wystarcza — produkt Content Posting API / Direct Post musi być zatwierdzony w App Review. Do czasu zatwierdzenia TikTok pozwala publikować tylko na prywatne konta testowe, więc ustaw konto @glowaccy.solution jako prywatne w aplikacji TikTok albo dokończ review Direct Post w TikTok Developer Portal dla aktualnego Client Key (${clientKeyFingerprint}). To nie jest błąd harmonogramu ani wideo. log_id=${logId}`,
          'TIKTOK_APP_UNAUDITED'
        );
      }

      if (errorCode === 'access_token_invalid') {
        throw makeError('Token dostępu wygasł. Połącz konto TikTok ponownie.', 'TOKEN_EXPIRED');
      }

      if (errorCode === 'scope_not_authorized') {
        throw makeError('Brak uprawnień do publikacji. Połącz konto TikTok ponownie z wymaganymi uprawnieniami.', 'TIKTOK_SCOPE_NOT_AUTHORIZED');
      }

      throw makeError(`Błąd TikTok: ${errorMsg} (log_id=${logId})`, errorCode || 'TIKTOK_ERROR');
    }

    console.log('TikTok init OK, usedFallback=', usedFallback, 'finalPrivacy=', privacyLevel);

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
        message: usedFallback
          ? 'Wideo wysłane do TikTok jako PRYWATNE (SELF_ONLY) — TikTok nie pozwala tej aplikacji publikować publicznie dla tego konta. Sprawdź zatwierdzenie Content Posting API w TikTok Developer Portal.'
          : 'Wideo wysłane do TikTok! Przetwarzanie może potrwać kilka minut.',
        privacyLevel,
        usedFallback,
        note: privacyLevel === 'PUBLIC_TO_EVERYONE'
          ? 'Post został wysłany jako publiczny.'
          : `Post został wysłany z widocznością ${privacyLevel}, zgodnie z ustawieniami dostępnymi dla konta/aplikacji TikTok.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Publish to TikTok error:', error);
    
    // Return HTTP 200 with success: false for expected errors
    // This prevents "edge function non-2xx" errors in the frontend
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        errorCode: error.code || null
      }),
      {
        status: 200, // Changed from 500 to 200 for better UX
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
