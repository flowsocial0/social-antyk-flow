import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function refreshAccessToken(supabase: any, token: any): Promise<string> {
  if (!token.refresh_token) {
    throw new Error('No refresh token available - reconnect Google Business account');
  }

  const GOOGLE_BUSINESS_CLIENT_ID = Deno.env.get('GOOGLE_BUSINESS_CLIENT_ID')!;
  const GOOGLE_BUSINESS_CLIENT_SECRET = Deno.env.get('GOOGLE_BUSINESS_CLIENT_SECRET')!;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      client_id: GOOGLE_BUSINESS_CLIENT_ID,
      client_secret: GOOGLE_BUSINESS_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google token refresh failed:', errorText);
    throw new Error('Failed to refresh Google Business token - reconnect account');
  }

  const data = await response.json();
  const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  await supabase.from('google_business_tokens').update({
    access_token: data.access_token,
    expires_at: newExpiresAt,
  }).eq('id', token.id);

  return data.access_token;
}

async function getValidAccessToken(supabase: any, token: any): Promise<string> {
  if (token.expires_at && new Date(token.expires_at) < new Date(Date.now() + 60000)) {
    console.log('Token expired or expiring soon, refreshing...');
    return await refreshAccessToken(supabase, token);
  }
  return token.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { testConnection, bookId, contentId, campaignPostId, userId, accountId, imageUrl } = body;
    console.log('Request body:', JSON.stringify({ testConnection, bookId, contentId, campaignPostId, userId, accountId }));

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const authHeader = req.headers.get('Authorization');
      console.log('Auth header present:', !!authHeader);
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        console.log('Auth result:', user?.id, 'error:', authError?.message);
        effectiveUserId = user?.id;
      }
    }
    if (!effectiveUserId) {
      console.log('No effective user ID found');
      return new Response(JSON.stringify({ success: false, error: 'User ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Effective user ID:', effectiveUserId);

    let query = supabase.from('google_business_tokens').select('*').eq('user_id', effectiveUserId);
    if (accountId) query = query.eq('id', accountId);
    const { data: tokens } = await query;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No Google Business account connected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (testConnection) {
      const token = tokens[0];
      try {
        const accessToken = await getValidAccessToken(supabase, token);
        const response = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const responseData = response.ok ? await response.json() : null;
        const accountCount = responseData?.accounts?.length || 0;
        return new Response(
          JSON.stringify({
            connected: response.ok,
            success: response.ok,
            business_name: token.business_name,
            accounts_count: accountCount,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ connected: false, success: false, error: err.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const getStoragePublicUrl = (storagePath: string): string => {
      return `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${storagePath}`;
    };

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
      const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
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

    const results = [];
    for (const token of tokens) {
      try {
        const accessToken = await getValidAccessToken(supabase, token);

        if (!token.account_id) {
          // Try to fetch account ID dynamically
          const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (accountsResponse.ok) {
            const accountsData = await accountsResponse.json();
            const firstAccount = accountsData.accounts?.[0];
            if (firstAccount) {
              token.account_id = firstAccount.name;
              await supabase.from('google_business_tokens').update({
                account_id: firstAccount.name,
                business_name: firstAccount.accountName || token.business_name,
              }).eq('id', token.id);
            }
          }
          if (!token.account_id) {
            results.push({ accountId: token.id, success: false, error: 'No Google Business account found' });
            continue;
          }
        }

        // Get locations using Business Information API v1
        const locationsResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${token.account_id}/locations?readMask=name,title,storefrontAddress`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!locationsResponse.ok) {
          const errText = await locationsResponse.text();
          console.error('Failed to get locations:', errText);
          results.push({ accountId: token.id, success: false, error: `Failed to get locations: ${locationsResponse.status}` });
          continue;
        }

        const locationsData = await locationsResponse.json();
        const location = locationsData.locations?.[0];
        if (!location) {
          results.push({ accountId: token.id, success: false, error: 'No locations found for this business' });
          continue;
        }

        const locationName = location.name;

        // Create local post using v4 API (still the current endpoint for posts)
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
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(postBody),
          }
        );

        if (!postResponse.ok) {
          const errorText = await postResponse.text();
          console.error('Google Business publish failed:', errorText);
          results.push({ accountId: token.id, success: false, error: errorText });
          continue;
        }

        const postResult = await postResponse.json();

        await supabase.from('platform_publications').insert({
          user_id: effectiveUserId,
          platform: 'google_business',
          account_id: token.id,
          post_id: postResult.name || '',
          book_id: bookData?.id || null,
          campaign_post_id: campaignPostId || null,
          published_at: new Date().toISOString(),
          source: campaignPostId ? 'campaign' : 'manual',
        });

        results.push({ accountId: token.id, success: true, postId: postResult.name });
      } catch (err: any) {
        console.error('Error publishing to Google Business:', err);
        results.push({ accountId: token.id, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: results.some(r => r.success), results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Google Business publish error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
