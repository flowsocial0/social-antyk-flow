import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Facebook Select Page(s) ===');
    
    const body = await req.json();
    
    // Support both single page and multiple pages
    const { userId, pageId, pageName, pageAccessToken, pages } = body;
    
    console.log('Received selection:', { userId, pageId, pageName, pagesCount: pages?.length });

    if (!userId) {
      throw new Error('Missing required parameter: userId');
    }

    // Validate: either single page params or pages array
    const isSinglePage = pageId && pageName && pageAccessToken;
    const isMultiplePages = Array.isArray(pages) && pages.length > 0;

    if (!isSinglePage && !isMultiplePages) {
      throw new Error('Missing required parameters: provide either (pageId, pageName, pageAccessToken) or pages array');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate expiration (long-lived page tokens are actually never-expiring)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // Helper function to save a single page
    const savePage = async (pId: string, pName: string, pToken: string, setAsDefault: boolean = false) => {
      console.log('Processing page:', pName, pId);

      // Check if this specific page is already connected for this user
      const { data: existingPage } = await supabase
        .from('facebook_oauth_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('page_id', pId)
        .maybeSingle();

      if (existingPage) {
        // Update existing page token
        console.log('Page already exists, updating token for:', pName);
        const { error: updateError } = await supabase
          .from('facebook_oauth_tokens')
          .update({
            access_token: pToken,
            expires_at: expiresAt.toISOString(),
            page_name: pName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPage.id);

        if (updateError) {
          console.error('Error updating Facebook token:', updateError);
          throw new Error('Failed to update Facebook token: ' + updateError.message);
        }
        return { id: existingPage.id, updated: true };
      } else {
        // Insert new page - never set as default (publish to all accounts)
        console.log('Inserting new page:', pName);
        const { data: newToken, error: insertError } = await supabase
          .from('facebook_oauth_tokens')
          .insert({
            user_id: userId,
            access_token: pToken,
            token_type: 'Bearer',
            expires_at: expiresAt.toISOString(),
            page_id: pId,
            page_name: pName,
            scope: 'pages_manage_posts,pages_read_engagement',
            is_default: false, // Never set default - we publish to all accounts
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error storing Facebook token:', insertError);
          throw new Error('Failed to store Facebook token: ' + insertError.message);
        }
        return { id: newToken.id, updated: false };
      }
    };

    const savedPages: { id: string; name: string; updated: boolean }[] = [];

    if (isSinglePage) {
      // Single page selection (legacy support)
      const result = await savePage(pageId, pageName, pageAccessToken, true);
      savedPages.push({ id: pageId, name: pageName, updated: result.updated });
    } else {
      // Multiple pages selection
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const setAsDefault = i === 0; // First page in the list becomes default if no default exists
        const result = await savePage(page.id, page.name, page.access_token, setAsDefault);
        savedPages.push({ id: page.id, name: page.name, updated: result.updated });
      }
    }

    console.log('Successfully saved Facebook Page tokens:', savedPages);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${savedPages.length} page(s) connected successfully`,
        saved_pages: savedPages,
        page_name: savedPages[0]?.name // For backwards compatibility
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Facebook select page error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
