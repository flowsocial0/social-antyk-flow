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

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        effectiveUserId = user?.id;
      }
    }
    if (!effectiveUserId) throw new Error('User ID is required');

    let query = supabase.from('google_business_tokens').select('*').eq('user_id', effectiveUserId);
    if (accountId) query = query.eq('id', accountId);
    const { data: tokens } = await query;
    if (!tokens || tokens.length === 0) throw new Error('No Google Business account connected');

    if (testConnection) {
      const token = tokens[0];
      const response = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { 'Authorization': `Bearer ${token.access_token}` },
      });
      return new Response(
        JSON.stringify({ connected: response.ok, business_name: token.business_name }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        if (!token.account_id) {
          results.push({ accountId: token.id, success: false, error: 'No Google Business account ID configured' });
          continue;
        }

        // Get locations for the account
        const locationsResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${token.account_id}/locations`,
          { headers: { 'Authorization': `Bearer ${token.access_token}` } }
        );

        if (!locationsResponse.ok) {
          results.push({ accountId: token.id, success: false, error: 'Failed to get locations' });
          continue;
        }

        const locationsData = await locationsResponse.json();
        const location = locationsData.locations?.[0];
        if (!location) {
          results.push({ accountId: token.id, success: false, error: 'No locations found for this business' });
          continue;
        }

        const locationName = location.name;

        // Create local post
        const postBody: any = {
          languageCode: 'pl',
          summary: text.substring(0, 1500),
          topicType: 'STANDARD',
        };

        if (mediaUrl) {
          postBody.media = [{ mediaFormat: 'PHOTO', sourceUrl: mediaUrl }];
        }

        if (bookData?.product_url) {
          postBody.callToAction = { actionType: 'LEARN_MORE', url: bookData.product_url };
        }

        const postResponse = await fetch(
          `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(postBody),
          }
        );

        if (!postResponse.ok) {
          const errorText = await postResponse.text();
          console.error(`Google Business publish failed:`, errorText);
          results.push({ accountId: token.id, success: false, error: errorText });
          continue;
        }

        const postResult = await postResponse.json();

        await supabase.from('platform_publications').insert({
          user_id: effectiveUserId, platform: 'google_business', account_id: token.id,
          post_id: postResult.name || '', book_id: bookData?.id || null,
          campaign_post_id: campaignPostId || null, published_at: new Date().toISOString(),
          source: campaignPostId ? 'campaign' : 'manual',
        });

        results.push({ accountId: token.id, success: true, postId: postResult.name });
      } catch (err: any) {
        results.push({ accountId: token.id, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: results.some(r => r.success), results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Google Business publish error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
