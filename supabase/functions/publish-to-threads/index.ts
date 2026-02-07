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
      `https://graph.threads.net/v1.0/${containerId}?fields=status&access_token=${accessToken}`
    );
    const data = await response.json();
    console.log(`Container status check ${i + 1}:`, data.status);
    
    if (data.status === 'FINISHED') return true;
    if (data.status === 'ERROR') throw new Error('Container processing failed');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(url);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Publish to Threads Request ===');
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let userId: string | null = null;
    let bookId: string | undefined;
    let contentId: string | undefined;
    let campaignPostId: string | undefined;
    let text: string | undefined;
    let imageUrl: string | undefined;
    let videoUrl: string | undefined;
    let testConnection: boolean | undefined;
    let userIdFromBody: string | undefined;
    let accountId: string | undefined;

    try {
      const body = await req.json();
      bookId = body.bookId;
      contentId = body.contentId;
      campaignPostId = body.campaignPostId;
      text = body.text || body.caption;
      imageUrl = body.imageUrl;
      videoUrl = body.videoUrl;
      testConnection = body.testConnection;
      userIdFromBody = body.userId;
      accountId = body.accountId;
    } catch (_) {
      testConnection = true;
    }

    // Get userId
    if (userIdFromBody) {
      userId = userIdFromBody;
    } else {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await supabaseAnon.auth.getUser();
        if (user) userId = user.id;
      }
    }

    if (!userId) throw new Error('Musisz być zalogowany aby publikować na Threads');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Threads token
    let tokenQuery = supabase.from('threads_oauth_tokens').select('*').eq('user_id', userId);
    if (accountId) {
      tokenQuery = tokenQuery.eq('id', accountId);
    }
    let { data: tokenData } = await tokenQuery.limit(1).maybeSingle();

    if (!tokenData) {
      throw new Error('Threads nie jest połączony. Połącz konto Threads w ustawieniach.');
    }

    const { access_token, threads_user_id, username, expires_at } = tokenData;

    if (expires_at && new Date(expires_at) < new Date()) {
      throw new Error('Token Threads wygasł. Połącz ponownie konto Threads.');
    }

    // Test connection
    if (testConnection || (!bookId && !contentId && !campaignPostId && !text && !imageUrl && !videoUrl)) {
      return new Response(JSON.stringify({
        success: true, connected: true, accountName: username, platform: 'threads',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Helper for storage URLs
    const getStoragePublicUrl = (storagePath: string): string => {
      return `${SUPABASE_URL}/storage/v1/object/public/ObrazkiKsiazek/${storagePath}`;
    };

    let postText = text || '';
    let finalImageUrl = imageUrl || '';
    let finalVideoUrl = videoUrl || '';

    // Get data from book
    if (bookId) {
      const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
      if (book) {
        if (!postText) {
          postText = book.ai_generated_text || `📚 ${book.title}`;
        }
        if (!finalVideoUrl && !finalImageUrl) {
          if (book.video_url && isVideoUrl(book.video_url)) finalVideoUrl = book.video_url;
          else if (book.image_url) {
            if (isVideoUrl(book.image_url)) finalVideoUrl = book.image_url;
            else finalImageUrl = book.image_url;
          } else if (book.storage_path) finalImageUrl = getStoragePublicUrl(book.storage_path);
        }
      }
    }

    // Get data from campaign post
    if (campaignPostId) {
      const { data: campaignPost } = await supabase
        .from('campaign_posts').select('*, book:books(*)').eq('id', campaignPostId).single();
      if (campaignPost) {
        postText = campaignPost.text;
        if (campaignPost.custom_image_url) {
          if (isVideoUrl(campaignPost.custom_image_url)) finalVideoUrl = campaignPost.custom_image_url;
          else finalImageUrl = campaignPost.custom_image_url;
        }
        if (campaignPost.book && !finalVideoUrl && !finalImageUrl) {
          if (campaignPost.book.storage_path) finalImageUrl = getStoragePublicUrl(campaignPost.book.storage_path);
          else if (campaignPost.book.image_url) finalImageUrl = campaignPost.book.image_url;
        }
      }
    }

    // Threads supports text-only, image, and video posts
    const isVideoPost = Boolean(finalVideoUrl);
    const isImagePost = Boolean(finalImageUrl) && !isVideoPost;
    const isTextOnly = !isVideoPost && !isImagePost;

    console.log('Post type:', isVideoPost ? 'VIDEO' : isImagePost ? 'IMAGE' : 'TEXT');

    let containerId: string;

    if (isTextOnly) {
      // Text-only post
      const containerResponse = await fetch(
        `https://graph.threads.net/v1.0/${threads_user_id}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            media_type: 'TEXT',
            text: postText,
            access_token: access_token,
          }).toString(),
        }
      );
      const containerData = await containerResponse.json();
      if (containerData.error) throw new Error(containerData.error.message || 'Nie udało się utworzyć posta Threads');
      containerId = containerData.id;
    } else if (isImagePost) {
      const params: Record<string, string> = {
        media_type: 'IMAGE',
        image_url: finalImageUrl,
        access_token: access_token,
      };
      if (postText) params.text = postText;

      const containerResponse = await fetch(
        `https://graph.threads.net/v1.0/${threads_user_id}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(params).toString(),
        }
      );
      const containerData = await containerResponse.json();
      if (containerData.error) throw new Error(containerData.error.message || 'Nie udało się utworzyć kontenera obrazu');
      containerId = containerData.id;
    } else {
      // Video post
      const params: Record<string, string> = {
        media_type: 'VIDEO',
        video_url: finalVideoUrl,
        access_token: access_token,
      };
      if (postText) params.text = postText;

      const containerResponse = await fetch(
        `https://graph.threads.net/v1.0/${threads_user_id}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(params).toString(),
        }
      );
      const containerData = await containerResponse.json();
      if (containerData.error) throw new Error(containerData.error.message || 'Nie udało się utworzyć kontenera wideo');
      containerId = containerData.id;

      // Wait for video processing
      const isReady = await waitForContainer(containerId, access_token, 60);
      if (!isReady) throw new Error('Przetwarzanie wideo przekroczyło limit czasu');
    }

    // Publish the container
    console.log('Publishing Threads container:', containerId);
    const publishResponse = await fetch(
      `https://graph.threads.net/v1.0/${threads_user_id}/threads_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: containerId,
          access_token: access_token,
        }).toString(),
      }
    );

    const publishData = await publishResponse.json();
    if (publishData.error) throw new Error(publishData.error.message || 'Nie udało się opublikować na Threads');

    const mediaId = publishData.id;
    console.log('Published successfully! Media ID:', mediaId);

    // Update records
    if (contentId) {
      await supabase.from('book_platform_content').update({
        published: true, published_at: new Date().toISOString(), post_id: mediaId,
      }).eq('id', contentId);
    }

    return new Response(JSON.stringify({
      success: true, mediaId, postId: mediaId,
      message: 'Pomyślnie opublikowano na Threads',
      results: [{ success: true, platform: 'threads', postId: mediaId }],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('Error in publish-to-threads:', error);
    return new Response(JSON.stringify({
      success: false, error: errorMessage,
      results: [{ success: false, platform: 'threads', error: errorMessage }],
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
