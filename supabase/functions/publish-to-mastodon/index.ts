import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(url);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Publish to Mastodon Request ===');

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

    if (!userId) throw new Error('Musisz być zalogowany aby publikować na Mastodon');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Mastodon token
    let tokenQuery = supabase.from('mastodon_tokens').select('*').eq('user_id', userId).not('access_token', 'like', 'pending_%');
    if (accountId) tokenQuery = tokenQuery.eq('id', accountId);
    const { data: tokenData } = await tokenQuery.limit(1).maybeSingle();

    if (!tokenData) {
      throw new Error('Mastodon nie jest połączony. Połącz konto w ustawieniach.');
    }

    const { access_token, server_url } = tokenData;

    // Test connection
    if (testConnection || (!bookId && !contentId && !campaignPostId && !text && !imageUrl && !videoUrl)) {
      const verifyRes = await fetch(`${server_url}/api/v1/accounts/verify_credentials`, {
        headers: { 'Authorization': `Bearer ${access_token}` },
      });
      const verified = verifyRes.ok;
      return new Response(JSON.stringify({
        success: verified, connected: verified,
        accountName: tokenData.username, platform: 'mastodon',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
        if (!postText) postText = book.ai_generated_text || `📚 ${book.title}`;
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

    // Mastodon max 500 chars
    if (postText.length > 500) {
      postText = postText.substring(0, 497) + '...';
    }

    // Upload media if present
    let mediaIds: string[] = [];
    const mediaUrl = finalVideoUrl || finalImageUrl;
    if (mediaUrl) {
      console.log('Uploading media to Mastodon:', mediaUrl.substring(0, 50));
      const mediaResponse = await fetch(mediaUrl);
      const mediaBlob = await mediaResponse.blob();

      const formData = new FormData();
      const ext = mediaUrl.split('.').pop()?.split('?')[0] || 'jpg';
      formData.append('file', mediaBlob, `media.${ext}`);
      formData.append('description', postText.substring(0, 100));

      const uploadResponse = await fetch(`${server_url}/api/v2/media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${access_token}` },
        body: formData,
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        mediaIds.push(uploadData.id);
        console.log('Media uploaded, id:', uploadData.id);
      } else {
        console.warn('Media upload failed, posting text only');
      }
    }

    // Create status
    console.log('Creating Mastodon status...');
    const statusBody: any = { status: postText };
    if (mediaIds.length > 0) statusBody.media_ids = mediaIds;

    const statusResponse = await fetch(`${server_url}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(statusBody),
    });

    if (!statusResponse.ok) {
      const errText = await statusResponse.text();
      throw new Error(`Błąd publikacji Mastodon: ${errText}`);
    }

    const statusData = await statusResponse.json();
    const postId = statusData.id;
    const postUrl = statusData.url;
    console.log('Published successfully! URL:', postUrl);

    if (contentId) {
      await supabase.from('book_platform_content').update({
        published: true, published_at: new Date().toISOString(), post_id: postId,
      }).eq('id', contentId);
    }

    return new Response(JSON.stringify({
      success: true, postId, postUrl,
      message: 'Pomyślnie opublikowano na Mastodon',
      results: [{ success: true, platform: 'mastodon', postId }],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('Error in publish-to-mastodon:', error);
    return new Response(JSON.stringify({
      success: false, error: errorMessage,
      results: [{ success: false, platform: 'mastodon', error: errorMessage }],
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
