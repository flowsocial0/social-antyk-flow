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
    console.log('=== Publish to Bluesky Request ===');
    
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

    if (!userId) throw new Error('Musisz być zalogowany aby publikować na Bluesky');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Bluesky credentials
    let tokenQuery = supabase.from('bluesky_tokens').select('*').eq('user_id', userId);
    if (accountId) tokenQuery = tokenQuery.eq('id', accountId);
    let { data: tokenData } = await tokenQuery.limit(1).maybeSingle();

    if (!tokenData) {
      throw new Error('Bluesky nie jest połączony. Dodaj konto Bluesky w ustawieniach.');
    }

    const { handle, app_password } = tokenData;

    // Create session (login)
    console.log('Creating Bluesky session for handle:', handle);
    const sessionResponse = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: handle, password: app_password }),
    });

    const sessionData = await sessionResponse.json();
    if (sessionData.error) {
      console.error('Bluesky session error:', sessionData);
      throw new Error(`Błąd logowania Bluesky: ${sessionData.message || sessionData.error}`);
    }

    const { accessJwt, did } = sessionData;

    // Update DID in database if needed
    if (did && did !== tokenData.did) {
      await supabase.from('bluesky_tokens').update({ did }).eq('id', tokenData.id);
    }

    // Test connection
    if (testConnection || (!bookId && !contentId && !campaignPostId && !text && !imageUrl && !videoUrl)) {
      return new Response(JSON.stringify({
        success: true, connected: true,
        accountName: handle, platform: 'bluesky',
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

    // Bluesky max 300 chars - truncate if needed
    if (postText.length > 300) {
      postText = postText.substring(0, 297) + '...';
    }

    // Upload image if present (Bluesky doesn't support video yet in standard posts)
    let embed: any = undefined;
    if (finalImageUrl) {
      console.log('Uploading image to Bluesky...');
      const imageResponse = await fetch(finalImageUrl);
      const imageBlob = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

      const uploadResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessJwt}`,
          'Content-Type': contentType,
        },
        body: imageBlob,
      });

      const uploadData = await uploadResponse.json();
      if (uploadData.error) {
        console.error('Image upload error:', uploadData);
        // Don't fail - publish text only
        console.warn('Falling back to text-only post');
      } else {
        embed = {
          $type: 'app.bsky.embed.images',
          images: [{
            alt: postText.substring(0, 100),
            image: uploadData.blob,
          }],
        };
      }
    }

    // Create post
    console.log('Creating Bluesky post...');
    const record: any = {
      $type: 'app.bsky.feed.post',
      text: postText,
      createdAt: new Date().toISOString(),
    };
    if (embed) record.embed = embed;

    const createResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repo: did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });

    const createData = await createResponse.json();
    if (createData.error) {
      throw new Error(`Błąd publikacji Bluesky: ${createData.message || createData.error}`);
    }

    const postUri = createData.uri;
    console.log('Published successfully! URI:', postUri);

    if (contentId) {
      await supabase.from('book_platform_content').update({
        published: true, published_at: new Date().toISOString(), post_id: postUri,
      }).eq('id', contentId);
    }

    return new Response(JSON.stringify({
      success: true, postUri, postId: postUri,
      message: 'Pomyślnie opublikowano na Bluesky',
      results: [{ success: true, platform: 'bluesky', postId: postUri }],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('Error in publish-to-bluesky:', error);
    return new Response(JSON.stringify({
      success: false, error: errorMessage,
      results: [{ success: false, platform: 'bluesky', error: errorMessage }],
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
