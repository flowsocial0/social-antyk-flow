import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONSUMER_KEY = Deno.env.get('TUMBLR_API_KEY')?.trim();
const CONSUMER_SECRET = Deno.env.get('TUMBLR_API_SECRET')?.trim();

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
}

function buildOAuth1Header(method: string, url: string, accessToken: string, tokenSecret: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };
  const signature = generateOAuthSignature(method, url, oauthParams, CONSUMER_SECRET!, tokenSecret);
  const signedParams = { ...oauthParams, oauth_signature: signature };
  return 'OAuth ' + Object.entries(signedParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { testConnection, bookId, contentId, campaignPostId, userId, accountId, imageUrl, videoUrl } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        effectiveUserId = user?.id;
      }
    }
    if (!effectiveUserId) {
      return new Response(JSON.stringify({ success: false, error: 'User ID is required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let query = supabase.from('tumblr_oauth_tokens').select('*').eq('user_id', effectiveUserId);
    if (accountId) query = query.eq('id', accountId);
    const { data: tokens, error: tokenError } = await query;
    if (tokenError || !tokens || tokens.length === 0) throw new Error('No Tumblr account connected');

    if (testConnection) {
      const token = tokens[0];
      const tokenSecret = token.oauth_token_secret || '';
      if (tokenSecret) {
        // OAuth1 test
        const testUrl = 'https://api.tumblr.com/v2/user/info';
        const authHeader = buildOAuth1Header('GET', testUrl, token.access_token, tokenSecret);
        const response = await fetch(testUrl, { headers: { Authorization: authHeader } });
        if (response.ok) {
          const userData = await response.json();
          return new Response(JSON.stringify({ connected: true, username: userData.response?.user?.name }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        // Legacy OAuth2 test
        const response = await fetch('https://api.tumblr.com/v2/user/info', {
          headers: { 'Authorization': `Bearer ${token.access_token}` },
        });
        if (response.ok) {
          const userData = await response.json();
          return new Response(JSON.stringify({ connected: true, username: userData.response?.user?.name }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      return new Response(JSON.stringify({ connected: false, error: 'Token invalid' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const getStoragePublicUrl = (storagePath: string): string => {
      return `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${storagePath}`;
    };

    let text = '';
    let mediaUrl = imageUrl || null;
    let videoMediaUrl = videoUrl || null;
    let bookData: any = null;

    if (campaignPostId) {
      const { data: post } = await supabase.from('campaign_posts').select('*, book:books(id, title, image_url, storage_path, product_url, video_url, video_storage_path)').eq('id', campaignPostId).single();
      if (post) {
        text = post.text; bookData = post.book;
        if (!mediaUrl && bookData?.storage_path) mediaUrl = getStoragePublicUrl(bookData.storage_path);
        else if (!mediaUrl && bookData?.image_url) mediaUrl = bookData.image_url;
        if (!videoMediaUrl && bookData?.video_storage_path) videoMediaUrl = getStoragePublicUrl(bookData.video_storage_path);
        else if (!videoMediaUrl && bookData?.video_url) videoMediaUrl = bookData.video_url;
      }
    } else if (bookId) {
      const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
      if (book) {
        bookData = book;
        if (!mediaUrl && book.storage_path) mediaUrl = getStoragePublicUrl(book.storage_path);
        else if (!mediaUrl && book.image_url) mediaUrl = book.image_url;
        if (!videoMediaUrl && book.video_storage_path) videoMediaUrl = getStoragePublicUrl(book.video_storage_path);
        else if (!videoMediaUrl && book.video_url) videoMediaUrl = book.video_url;
        const { data: content } = await supabase.from('book_platform_content').select('*').eq('id', contentId || '').single();
        text = content?.custom_text || content?.ai_generated_text || book.title;
      }
    }

    const results = [];
    for (const token of tokens) {
      try {
        const blogName = token.blog_name || token.username;
        if (!blogName) { results.push({ accountId: token.id, success: false, error: 'No blog name' }); continue; }

        const tokenSecret = token.oauth_token_secret || '';
        const postUrl = `https://api.tumblr.com/v2/blog/${blogName}/posts`;
        let response: Response;

        if (videoMediaUrl && tokenSecret) {
          // OAuth1 binary video upload via multipart/form-data
          console.log(`Downloading video from: ${videoMediaUrl}`);
          const videoResponse = await fetch(videoMediaUrl);
          if (!videoResponse.ok) {
            results.push({ accountId: token.id, success: false, error: `Failed to download video: ${videoResponse.status}` });
            continue;
          }
          const contentType = videoResponse.headers.get('content-type');
          console.log(`Video content-type from source: ${contentType}`);
          const videoArrayBuffer = await videoResponse.arrayBuffer();
          console.log(`Video size: ${(videoArrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

          if (videoArrayBuffer.byteLength < 10000) {
            results.push({ accountId: token.id, success: false, error: 'Video file too small or invalid' });
            continue;
          }

          const videoIdentifier = 'video_0';
          const contentBlocks: any[] = [];
          if (text) contentBlocks.push({ type: 'text', text });
          contentBlocks.push({
            type: 'video',
            media: { type: 'video/mp4', identifier: videoIdentifier },
          });

          const jsonPayload = JSON.stringify({ content: contentBlocks, state: 'published' });
          console.log(`NPF payload: ${jsonPayload}`);

          const formData = new FormData();
          formData.append('json', new Blob([jsonPayload], { type: 'application/json' }));
          formData.append(videoIdentifier, new Blob([videoArrayBuffer], { type: 'video/mp4' }), 'video.mp4');

          const authHeader = buildOAuth1Header('POST', postUrl, token.access_token, tokenSecret);
          console.log(`Uploading video to Tumblr blog: ${blogName} (OAuth1)`);

          response = await fetch(postUrl, {
            method: 'POST',
            headers: { Authorization: authHeader },
            body: formData,
          });
        } else {
          // JSON post: text + optional video URL or image
          const content: any[] = [{ type: 'text', text: text || '' }];
          if (videoMediaUrl) {
            console.log(`Publishing video via URL: ${videoMediaUrl}`);
            content.push({ type: 'video', url: videoMediaUrl });
          } else if (mediaUrl) {
            content.push({ type: 'image', media: [{ url: mediaUrl }] });
          }

          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (tokenSecret) {
            headers['Authorization'] = buildOAuth1Header('POST', postUrl, token.access_token, tokenSecret);
          } else {
            headers['Authorization'] = `Bearer ${token.access_token}`;
          }

          response = await fetch(postUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ content, state: 'published' }),
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Tumblr publish failed for ${token.id}:`, errorText);
          results.push({ accountId: token.id, success: false, error: errorText });
          continue;
        }

        const result = await response.json();
        const postId = result.response?.id;

        await supabase.from('platform_publications').insert({
          user_id: effectiveUserId, platform: 'tumblr', account_id: token.id,
          post_id: String(postId || ''), book_id: bookData?.id || null,
          campaign_post_id: campaignPostId || null, published_at: new Date().toISOString(),
          source: campaignPostId ? 'campaign' : 'manual',
        });

        results.push({ accountId: token.id, success: true, postId });
      } catch (err: any) {
        console.error(`Tumblr error for account ${token.id}:`, err);
        results.push({ accountId: token.id, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: results.some(r => r.success), results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Tumblr publish error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
