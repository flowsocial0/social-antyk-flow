import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { testConnection, bookId, contentId, campaignPostId, userId, accountId, imageUrl } = body;

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
    if (!effectiveUserId) throw new Error('User ID is required');

    let query = supabase.from('tumblr_oauth_tokens').select('*').eq('user_id', effectiveUserId);
    if (accountId) query = query.eq('id', accountId);
    const { data: tokens, error: tokenError } = await query;
    if (tokenError || !tokens || tokens.length === 0) throw new Error('No Tumblr account connected');

    if (testConnection) {
      const token = tokens[0];
      const response = await fetch('https://api.tumblr.com/v2/user/info', {
        headers: { 'Authorization': `Bearer ${token.access_token}` },
      });
      if (response.ok) {
        const userData = await response.json();
        return new Response(JSON.stringify({ connected: true, username: userData.response?.user?.name }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ connected: false, error: 'Token invalid' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let text = '';
    let mediaUrl = imageUrl || null;
    let bookData: any = null;

    if (campaignPostId) {
      const { data: post } = await supabase.from('campaign_posts').select('*, book:books(id, title, image_url, product_url)').eq('id', campaignPostId).single();
      if (post) { text = post.text; bookData = post.book; if (!mediaUrl && bookData?.image_url) mediaUrl = bookData.image_url; }
    } else if (bookId) {
      const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
      if (book) {
        bookData = book;
        if (!mediaUrl && book.image_url) mediaUrl = book.image_url;
        const { data: content } = await supabase.from('book_platform_content').select('*').eq('id', contentId || '').single();
        text = content?.custom_text || content?.ai_generated_text || book.title;
      }
    }

    const results = [];
    for (const token of tokens) {
      try {
        const blogName = token.blog_name || token.username;
        if (!blogName) { results.push({ accountId: token.id, success: false, error: 'No blog name' }); continue; }

        // Build NPF (Neue Post Format) content
        const content: any[] = [{ type: 'text', text: text || '' }];
        if (mediaUrl) {
          content.push({ type: 'image', media: [{ url: mediaUrl }] });
        }

        const response = await fetch(`https://api.tumblr.com/v2/blog/${blogName}/posts`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, state: 'published' }),
        });

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
        results.push({ accountId: token.id, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: results.some(r => r.success), results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Tumblr publish error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
