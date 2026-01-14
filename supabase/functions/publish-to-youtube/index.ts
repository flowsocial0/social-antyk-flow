import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_CLIENT_ID = Deno.env.get('YOUTUBE_CLIENT_ID');
const YOUTUBE_CLIENT_SECRET = Deno.env.get('YOUTUBE_CLIENT_SECRET');

interface PublishRequest {
  userId: string;
  title: string;
  description: string;
  videoUrl: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  tags?: string[];
  categoryId?: string;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
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
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }

  return data;
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
    const { userId, title, description, videoUrl, privacyStatus = 'public', tags = [], categoryId = '22' } = requestData;

    if (!userId || !title || !videoUrl) {
      throw new Error('Missing required fields: userId, title, videoUrl');
    }

    console.log('Publishing to YouTube for user:', userId);
    console.log('Video title:', title);

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // Get user's YouTube tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('youtube_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token fetch error:', tokenError);
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
        console.log('Token expired or expiring soon, refreshing...');
        
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

        console.log('Token refreshed successfully');
      }
    }

    // Download the video from the provided URL
    console.log('Downloading video from:', videoUrl);
    const videoResponse = await fetch(videoUrl);
    
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoSize = videoBlob.size;
    console.log('Video size:', videoSize, 'bytes');

    // Prepare video metadata
    const metadata = {
      snippet: {
        title: title.substring(0, 100), // YouTube title limit
        description: description?.substring(0, 5000) || '', // YouTube description limit
        tags: tags.slice(0, 500), // YouTube allows up to 500 tags
        categoryId: categoryId,
      },
      status: {
        privacyStatus: privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    };

    // Step 1: Initialize resumable upload
    console.log('Initializing resumable upload...');
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
      console.error('Upload init error:', errorText);
      
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

    console.log('Upload URL received, uploading video...');

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
      console.error('Video upload error:', errorText);
      throw new Error(`Failed to upload video: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('Video uploaded successfully:', uploadResult.id);

    return new Response(
      JSON.stringify({
        success: true,
        videoId: uploadResult.id,
        videoUrl: `https://www.youtube.com/watch?v=${uploadResult.id}`,
        channelId: uploadResult.snippet?.channelId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error publishing to YouTube:', error);
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
