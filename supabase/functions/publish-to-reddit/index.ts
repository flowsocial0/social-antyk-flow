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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine user ID
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

    // Get Reddit token(s)
    let query = supabase.from('reddit_oauth_tokens').select('*').eq('user_id', effectiveUserId);
    if (accountId) query = query.eq('id', accountId);

    const { data: tokens, error: tokenError } = await query;
    if (tokenError || !tokens || tokens.length === 0) {
      throw new Error('No Reddit account connected');
    }

    // Test connection mode
    if (testConnection) {
      const token = tokens[0];
      const response = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'User-Agent': 'BookPromoter/1.0',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        return new Response(
          JSON.stringify({ connected: true, username: userData.name }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ connected: false, error: 'Token invalid or expired' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get content to publish
    let text = '';
    let title = '';
    let mediaUrl = imageUrl || null;
    let bookData: any = null;
    let productUrl: string | null = null;

    const getStoragePublicUrl = (storagePath: string): string => {
      return `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${storagePath}`;
    };

    if (campaignPostId) {
      const { data: post } = await supabase
        .from('campaign_posts')
        .select('*, book:books(id, title, image_url, storage_path, product_url)')
        .eq('id', campaignPostId)
        .single();

      if (post) {
        text = post.text;
        title = post.text.substring(0, 300);
        bookData = post.book;
        if (!mediaUrl && bookData?.storage_path) mediaUrl = getStoragePublicUrl(bookData.storage_path);
        else if (!mediaUrl && bookData?.image_url) mediaUrl = bookData.image_url;
        productUrl = bookData?.product_url || null;
      }
    } else if (bookId) {
      const { data: book } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (book) {
        bookData = book;
        title = book.title;
        productUrl = book.product_url;
        if (!mediaUrl && book.storage_path) mediaUrl = getStoragePublicUrl(book.storage_path);
        else if (!mediaUrl && book.image_url) mediaUrl = book.image_url;

        const { data: content } = await supabase
          .from('book_platform_content')
          .select('*')
          .eq('id', contentId || '')
          .single();

        text = content?.custom_text || content?.ai_generated_text || book.title;
      }
    }

    if (!title) title = text.substring(0, 300);

    // Publish to all target accounts
    const results = [];
    for (const token of tokens) {
      try {
        const subreddit = token.default_subreddit || 'u_' + (token.username || 'me');

        // Submit as a self post (text) or link post
        const postData: Record<string, string> = {
          api_type: 'json',
          kind: productUrl ? 'link' : 'self',
          sr: subreddit,
          title: title.substring(0, 300),
          resubmit: 'true',
        };

        if (productUrl) {
          postData.url = productUrl;
        } else {
          postData.text = text;
        }

        const response = await fetch('https://oauth.reddit.com/api/submit', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'BookPromoter/1.0',
          },
          body: new URLSearchParams(postData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Reddit publish failed for account ${token.id}:`, errorText);
          results.push({ accountId: token.id, success: false, error: errorText });
          continue;
        }

        const result = await response.json();
        const postId = result?.json?.data?.id || result?.json?.data?.name || null;

        if (result?.json?.errors?.length > 0) {
          const errorMsg = result.json.errors.map((e: any) => e.join(': ')).join('; ');
          console.error(`Reddit submit errors:`, errorMsg);
          results.push({ accountId: token.id, success: false, error: errorMsg });
          continue;
        }

        console.log(`Published to Reddit r/${subreddit}, post: ${postId}`);

        // Record publication
        await supabase.from('platform_publications').insert({
          user_id: effectiveUserId,
          platform: 'reddit',
          account_id: token.id,
          post_id: postId,
          book_id: bookData?.id || null,
          campaign_post_id: campaignPostId || null,
          published_at: new Date().toISOString(),
          source: campaignPostId ? 'campaign' : 'manual',
        });

        results.push({ accountId: token.id, success: true, postId });
      } catch (err: any) {
        console.error(`Error publishing to Reddit account ${token.id}:`, err);
        results.push({ accountId: token.id, success: false, error: err.message });
      }
    }

    const anySuccess = results.some(r => r.success);

    return new Response(
      JSON.stringify({ success: anySuccess, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Reddit publish error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
