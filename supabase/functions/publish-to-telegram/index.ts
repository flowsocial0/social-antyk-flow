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
    console.log('=== Publish to Telegram Request ===');
    
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

    if (!userId) throw new Error('Musisz być zalogowany aby publikować na Telegram');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Telegram token
    let tokenQuery = supabase.from('telegram_tokens').select('*').eq('user_id', userId);
    if (accountId) tokenQuery = tokenQuery.eq('id', accountId);
    let { data: tokenData } = await tokenQuery.limit(1).maybeSingle();

    if (!tokenData) {
      throw new Error('Telegram nie jest skonfigurowany. Dodaj Bot Token i Chat ID w ustawieniach.');
    }

    const { bot_token, chat_id, channel_name } = tokenData;

    // Test connection
    if (testConnection || (!bookId && !contentId && !campaignPostId && !text && !imageUrl && !videoUrl)) {
      // Test by calling getMe
      const meResponse = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
      const meData = await meResponse.json();
      
      return new Response(JSON.stringify({
        success: meData.ok,
        connected: meData.ok,
        accountName: channel_name || meData.result?.username || chat_id,
        platform: 'telegram',
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
          else if (book.storage_path) finalImageUrl = getStoragePublicUrl(book.storage_path);
          else if (book.image_url) {
            if (isVideoUrl(book.image_url)) finalVideoUrl = book.image_url;
            else finalImageUrl = book.image_url;
          }
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

    const isVideoPost = Boolean(finalVideoUrl);
    const isImagePost = Boolean(finalImageUrl) && !isVideoPost;

    console.log('Post type:', isVideoPost ? 'VIDEO' : isImagePost ? 'IMAGE' : 'TEXT');

    let result: any;

    if (isVideoPost) {
      // Send video
      const response = await fetch(`https://api.telegram.org/bot${bot_token}/sendVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          video: finalVideoUrl,
          caption: postText || undefined,
          parse_mode: 'HTML',
        }),
      });
      result = await response.json();
    } else if (isImagePost) {
      // Send photo
      const response = await fetch(`https://api.telegram.org/bot${bot_token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          photo: finalImageUrl,
          caption: postText || undefined,
          parse_mode: 'HTML',
        }),
      });
      result = await response.json();
    } else {
      // Send text message
      const response = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          text: postText,
          parse_mode: 'HTML',
        }),
      });
      result = await response.json();
    }

    if (!result.ok) {
      console.error('Telegram API error:', result);
      throw new Error(result.description || 'Nie udało się opublikować na Telegram');
    }

    const messageId = result.result?.message_id;
    console.log('Published successfully! Message ID:', messageId);

    if (contentId) {
      await supabase.from('book_platform_content').update({
        published: true, published_at: new Date().toISOString(), post_id: String(messageId),
      }).eq('id', contentId);
    }

    return new Response(JSON.stringify({
      success: true, messageId, postId: String(messageId),
      message: 'Pomyślnie opublikowano na Telegram',
      results: [{ success: true, platform: 'telegram', postId: String(messageId) }],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('Error in publish-to-telegram:', error);
    return new Response(JSON.stringify({
      success: false, error: errorMessage,
      results: [{ success: false, platform: 'telegram', error: errorMessage }],
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
