import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// TODO: Switch to production API (api.pinterest.com) after getting full access approval
const PINTEREST_API_BASE = 'https://api-sandbox.pinterest.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
      console.log('Auth header present:', !!authHeader);
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        console.log('getUser result:', { userId: user?.id, error: authError?.message });
        effectiveUserId = user?.id;
      }
    }
    console.log('Effective user ID:', effectiveUserId);

    if (!effectiveUserId) {
      return new Response(JSON.stringify({ success: false, error: 'User ID is required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get Pinterest token(s)
    let query = supabase.from('pinterest_oauth_tokens').select('*').eq('user_id', effectiveUserId);
    if (accountId) query = query.eq('id', accountId);

    const { data: tokens, error: tokenError } = await query;
    if (tokenError || !tokens || tokens.length === 0) {
      throw new Error('No Pinterest account connected');
    }

    // Test connection mode
    if (testConnection) {
      const token = tokens[0];
      console.log('Testing Pinterest connection with token ID:', token.id);
      console.log('Access token length:', token.access_token?.length);
      
      try {
        const response = await fetch(`${PINTEREST_API_BASE}/v5/user_account`, {
          headers: { 'Authorization': `Bearer ${token.access_token}` },
        });

        const responseText = await response.text();
        console.log('Pinterest API status:', response.status);
        console.log('Pinterest API response:', responseText);

        if (response.ok) {
          const userData = JSON.parse(responseText);
          return new Response(
            JSON.stringify({ connected: true, success: true, username: userData.username }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({ connected: false, success: false, error: `Pinterest API error: ${response.status} - ${responseText}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (fetchErr: any) {
        console.error('Pinterest API fetch error:', fetchErr);
        return new Response(
          JSON.stringify({ connected: false, success: false, error: fetchErr.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const getStoragePublicUrl = (storagePath: string): string => {
      return `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${storagePath}`;
    };

    // Get content to publish
    let text = '';
    let mediaUrl = imageUrl || null;
    let bookData: any = null;

    if (campaignPostId) {
      const { data: post } = await supabase
        .from('campaign_posts')
        .select('*, book:books(id, title, image_url, storage_path, product_url)')
        .eq('id', campaignPostId)
        .single();

      if (post) {
        text = post.text;
        bookData = post.book;
        if (!mediaUrl && bookData?.storage_path) mediaUrl = getStoragePublicUrl(bookData.storage_path);
        else if (!mediaUrl && bookData?.image_url) mediaUrl = bookData.image_url;
      }
    } else if (bookId) {
      const { data: book } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (book) {
        bookData = book;
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

    if (!mediaUrl) {
      throw new Error('Pinterest requires an image. No image URL provided.');
    }

    // Publish to all target accounts
    const results = [];
    for (const token of tokens) {
      try {
        // Create a pin
        const pinData: any = {
          title: text.substring(0, 100),
          description: text.substring(0, 500),
          media_source: {
            source_type: 'image_url',
            url: mediaUrl,
          },
        };

        if (bookData?.product_url) {
          pinData.link = bookData.product_url;
        }

        const response = await fetch(`${PINTEREST_API_BASE}/v5/pins`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pinData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Pinterest publish failed for account ${token.id}:`, errorText);
          results.push({ accountId: token.id, success: false, error: errorText });
          continue;
        }

        const result = await response.json();
        console.log(`Published pin ${result.id} to Pinterest account ${token.id}`);

        // Record publication
        await supabase.from('platform_publications').insert({
          user_id: effectiveUserId,
          platform: 'pinterest',
          account_id: token.id,
          post_id: result.id,
          book_id: bookData?.id || null,
          campaign_post_id: campaignPostId || null,
          published_at: new Date().toISOString(),
          source: campaignPostId ? 'campaign' : 'manual',
        });

        results.push({ accountId: token.id, success: true, postId: result.id });
      } catch (err: any) {
        console.error(`Error publishing to Pinterest account ${token.id}:`, err);
        results.push({ accountId: token.id, success: false, error: err.message });
      }
    }

    const anySuccess = results.some(r => r.success);

    return new Response(
      JSON.stringify({ success: anySuccess, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Pinterest publish error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
