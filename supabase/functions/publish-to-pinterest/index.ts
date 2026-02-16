import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Production API for connection test & reads (OAuth token works here)
const PINTEREST_API_PROD = 'https://api.pinterest.com';
// Sandbox API for pin creation during Trial access (requires sandbox token)
const PINTEREST_API_SANDBOX = 'https://api-sandbox.pinterest.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getApiBase(isSandbox: boolean): string {
  return isSandbox ? PINTEREST_API_SANDBOX : PINTEREST_API_PROD;
}

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
      const isSandbox = token.is_sandbox === true;
      const apiBase = getApiBase(isSandbox);
      console.log(`Testing Pinterest connection (sandbox=${isSandbox}) with token ID:`, token.id);

      try {
        const response = await fetch(`${apiBase}/v5/user_account`, {
          headers: { 'Authorization': `Bearer ${token.access_token}` },
        });

        const responseText = await response.text();
        console.log('Pinterest API status:', response.status);

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
        const isSandbox = token.is_sandbox === true;
        const apiBase = getApiBase(isSandbox);
        console.log(`Publishing pin (sandbox=${isSandbox}) to account ${token.id}`);

        // Get first available board
        const boardsResponse = await fetch(`${apiBase}/v5/boards`, {
          headers: { 'Authorization': `Bearer ${token.access_token}` },
        });

        let boardId: string | null = null;
        if (boardsResponse.ok) {
          const boardsData = await boardsResponse.json();
          if (boardsData.items && boardsData.items.length > 0) {
            boardId = boardsData.items[0].id;
            console.log(`Using board: ${boardsData.items[0].name} (${boardId})`);
          }
        } else {
          const boardsError = await boardsResponse.text();
          console.error(`Failed to fetch boards: ${boardsResponse.status} - ${boardsError}`);
        }

        // If no boards found, create one automatically
        if (!boardId) {
          console.log('No boards found, creating default board...');
          const createBoardResponse = await fetch(`${apiBase}/v5/boards`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: 'FlowSocial Books',
              description: 'Automatycznie utworzony board do publikacji ksiazek',
              privacy: 'PUBLIC',
            }),
          });

          if (createBoardResponse.ok) {
            const newBoard = await createBoardResponse.json();
            boardId = newBoard.id;
            console.log(`Created new board: ${newBoard.name} (${boardId})`);
          } else {
            const errorText = await createBoardResponse.text();
            console.error('Failed to create board:', errorText);
            results.push({ accountId: token.id, success: false, error: `Cannot create board: ${errorText}` });
            continue;
          }
        }

        const pinData: any = {
          board_id: boardId,
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

        let response = await fetch(`${apiBase}/v5/pins`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pinData),
        });

        // Auto-retry with sandbox API if Trial access error on production
        if (!response.ok) {
          const errorText = await response.text();
          if (!isSandbox && errorText.includes('Trial access')) {
            console.log('Trial access detected, retrying with Sandbox API...');
            const sandboxBase = PINTEREST_API_SANDBOX;
            
            // Re-fetch board from sandbox
            const sbBoardsRes = await fetch(`${sandboxBase}/v5/boards`, {
              headers: { 'Authorization': `Bearer ${token.access_token}` },
            });
            let sbBoardId: string | null = null;
            if (sbBoardsRes.ok) {
              const sbData = await sbBoardsRes.json();
              console.log('Sandbox boards response:', JSON.stringify(sbData));
              if (sbData.items?.length > 0) sbBoardId = sbData.items[0].id;
            } else {
              const sbBoardsErr = await sbBoardsRes.text();
              console.error(`Sandbox boards fetch failed: ${sbBoardsRes.status} - ${sbBoardsErr}`);
            }
            if (!sbBoardId) {
              console.log('No sandbox boards found, creating one...');
              const createRes = await fetch(`${sandboxBase}/v5/boards`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'FlowSocial Books', privacy: 'PUBLIC' }),
              });
              if (createRes.ok) {
                const nb = await createRes.json();
                sbBoardId = nb.id;
                console.log(`Created sandbox board: ${nb.name} (${sbBoardId})`);
              } else {
                const createErr = await createRes.text();
                console.error(`Failed to create sandbox board: ${createRes.status} - ${createErr}`);
              }
            }
            if (sbBoardId) {
              pinData.board_id = sbBoardId;
              response = await fetch(`${sandboxBase}/v5/pins`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(pinData),
              });
              if (!response.ok) {
                const retryErr = await response.text();
                console.error(`Sandbox retry also failed:`, retryErr);
                results.push({ accountId: token.id, success: false, error: retryErr });
                continue;
              }
              // Update token to sandbox for future calls
              await supabase.from('pinterest_oauth_tokens').update({ is_sandbox: true }).eq('id', token.id);
            } else {
              console.error(`Pinterest publish failed for account ${token.id}:`, errorText);
              results.push({ accountId: token.id, success: false, error: errorText });
              continue;
            }
          } else {
            console.error(`Pinterest publish failed for account ${token.id}:`, errorText);
            results.push({ accountId: token.id, success: false, error: errorText });
            continue;
          }
        }

        const result = await response.json();
        console.log(`Published pin ${result.id} to Pinterest account ${token.id}`);

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
