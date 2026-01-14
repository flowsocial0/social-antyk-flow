import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_CLIENT_ID = Deno.env.get('YOUTUBE_CLIENT_ID');
const YOUTUBE_CLIENT_SECRET = Deno.env.get('YOUTUBE_CLIENT_SECRET');

interface PublishRequest {
  // New unified API - preferred
  bookId?: string;
  contentId?: string;
  campaignPostId?: string;
  platform?: string;
  // Legacy API - backwards compatibility
  userId?: string;
  title?: string;
  description?: string;
  videoUrl?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  tags?: string[];
  categoryId?: string;
}

interface Book {
  id: string;
  title: string;
  description?: string;
  video_url?: string;
  video_storage_path?: string;
  ai_text_youtube?: string;
  ai_text_x?: string;
  author?: string;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  console.log('[YouTube] Refreshing access token...');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID!,
      client_secret: YOUTUBE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  
  if (data.error) {
    console.error('[YouTube] Token refresh failed:', data);
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }

  console.log('[YouTube] Token refreshed successfully');
  return data;
}

function getPublicUrl(storagePath: string, supabaseUrl: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${storagePath}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
      throw new Error('YouTube OAuth not configured');
    }

    const requestData: PublishRequest = await req.json();
    console.log('[YouTube] Publish request received:', JSON.stringify({
      bookId: requestData.bookId,
      contentId: requestData.contentId,
      campaignPostId: requestData.campaignPostId,
      userId: requestData.userId,
      hasTitle: !!requestData.title,
      hasVideoUrl: !!requestData.videoUrl,
    }));

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    let videoUrl: string | undefined = requestData.videoUrl;
    let title: string | undefined = requestData.title;
    let description: string | undefined = requestData.description;
    let userId: string | undefined = requestData.userId;
    const privacyStatus = requestData.privacyStatus || 'public';
    const tags = requestData.tags || [];
    const categoryId = requestData.categoryId || '22';

    // If bookId is provided, fetch book data from database
    if (requestData.bookId) {
      console.log('[YouTube] Fetching book data for bookId:', requestData.bookId);
      
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', requestData.bookId)
        .single();

      if (bookError || !book) {
        console.error('[YouTube] Failed to fetch book:', bookError);
        throw new Error(`Book not found: ${bookError?.message}`);
      }

      const typedBook = book as Book;
      console.log('[YouTube] Book found:', typedBook.title);

      // Get video URL from book - prefer video_url (full URL) over storage_path
      if (typedBook.video_url) {
        videoUrl = typedBook.video_url;
        console.log('[YouTube] Using video URL:', videoUrl);
      } else if (typedBook.video_storage_path) {
        // Fallback to storage path - assumes bucket is ObrazkiKsiazek
        videoUrl = `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${typedBook.video_storage_path}`;
        console.log('[YouTube] Using video from storage path:', videoUrl);
      }

      // Get title and description
      if (!title) {
        title = typedBook.title;
      }
      if (!description) {
        description = typedBook.ai_text_youtube || typedBook.description || typedBook.ai_text_x || '';
        
        // Add author if available
        if (typedBook.author) {
          description = `${description}\n\nAutor: ${typedBook.author}`;
        }
      }
    }

    // If contentId is provided, try to get userId from content
    if (requestData.contentId && !userId) {
      console.log('[YouTube] Fetching content for contentId:', requestData.contentId);
      
      const { data: content, error: contentError } = await supabase
        .from('book_platform_content')
        .select('user_id')
        .eq('id', requestData.contentId)
        .single();

      if (!contentError && content && content.user_id) {
        userId = content.user_id;
        console.log('[YouTube] Got userId from content:', userId);
      }
    }

    // If still no userId, get the first available YouTube token user
    if (!userId) {
      console.log('[YouTube] No userId provided, fetching from youtube_oauth_tokens...');
      const { data: tokenData, error: tokenError } = await supabase
        .from('youtube_oauth_tokens')
        .select('user_id')
        .limit(1)
        .single();

      if (!tokenError && tokenData) {
        userId = tokenData.user_id;
        console.log('[YouTube] Got userId from tokens table:', userId);
      }
    }

    // Validate required fields
    if (!videoUrl) {
      throw new Error('Video URL is required. Please upload a video for this book.');
    }

    if (!title) {
      throw new Error('Title is required');
    }

    if (!userId) {
      throw new Error('User ID is required - either provide userId or contentId');
    }

    console.log('[YouTube] Publishing video:', title);

    // Get user's YouTube tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('youtube_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.error('[YouTube] Token fetch error:', tokenError);
      throw new Error('YouTube account not connected');
    }

    let accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Check if token is expired and refresh if needed
    if (tokenData.expires_at) {
      const expiresAt = new Date(tokenData.expires_at);
      const now = new Date();
      
      // Refresh if token expires in less than 5 minutes
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        console.log('[YouTube] Token expired or expiring soon, refreshing...');
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const newTokens = await refreshAccessToken(refreshToken);
        accessToken = newTokens.access_token;

        // Update stored tokens
        const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
        await supabase
          .from('youtube_oauth_tokens')
          .update({
            access_token: accessToken,
            expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log('[YouTube] Token refreshed successfully');
      }
    }

    // Download the video from the provided URL
    console.log('[YouTube] Downloading video from:', videoUrl);
    const videoResponse = await fetch(videoUrl);
    
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoSize = videoBlob.size;
    console.log('[YouTube] Video size:', videoSize, 'bytes');

    // Truncate title if too long (YouTube limit: 100 chars)
    const truncatedTitle = title.length > 100 ? title.substring(0, 97) + '...' : title;
    
    // Truncate description if too long (YouTube limit: 5000 chars)
    const truncatedDescription = (description || '').length > 5000 
      ? (description || '').substring(0, 4997) + '...' 
      : (description || '');

    // Prepare video metadata
    const metadata = {
      snippet: {
        title: truncatedTitle,
        description: truncatedDescription,
        tags: tags.slice(0, 500), // YouTube allows up to 500 tags
        categoryId: categoryId,
      },
      status: {
        privacyStatus: privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    };

    // Step 1: Initialize resumable upload
    console.log('[YouTube] Initializing resumable upload...');
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': videoSize.toString(),
          'X-Upload-Content-Type': videoBlob.type || 'video/mp4',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error('[YouTube] Upload init error:', errorText);
      
      // Check for quota exceeded
      if (initResponse.status === 403) {
        throw new Error('YouTube API quota exceeded. Try again tomorrow.');
      }
      
      throw new Error(`Failed to initialize upload: ${initResponse.status}`);
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('No upload URL received');
    }

    console.log('[YouTube] Upload URL received, uploading video...');

    // Step 2: Upload the video
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': videoBlob.type || 'video/mp4',
        'Content-Length': videoSize.toString(),
      },
      body: videoBlob,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[YouTube] Video upload error:', errorText);
      throw new Error(`Failed to upload video: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('[YouTube] Video uploaded successfully:', uploadResult.id);

    const youtubeVideoId = uploadResult.id;
    const youtubeVideoUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    // Update book_platform_content if contentId was provided
    if (requestData.contentId) {
      console.log('[YouTube] Updating content record...');
      await supabase
        .from('book_platform_content')
        .update({
          published: true,
          published_at: new Date().toISOString(),
          post_id: youtubeVideoId,
          post_url: youtubeVideoUrl,
          youtube_video_id: youtubeVideoId,
          error_message: null,
        })
        .eq('id', requestData.contentId);
    }

    // Update campaign_posts if campaignPostId was provided
    if (requestData.campaignPostId) {
      console.log('[YouTube] Updating campaign post...');
      await supabase
        .from('campaign_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          post_id: youtubeVideoId,
          post_url: youtubeVideoUrl,
          error_message: null,
        })
        .eq('id', requestData.campaignPostId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoId: youtubeVideoId,
        videoUrl: youtubeVideoUrl,
        channelId: uploadResult.snippet?.channelId,
        message: 'Video published successfully to YouTube',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[YouTube] Error publishing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
