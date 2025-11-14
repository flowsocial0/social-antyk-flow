import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Book {
  id: string;
  code: string;
  title: string;
  image_url: string | null;
  sale_price: number | null;
  promotional_price: number | null;
}

interface CampaignPost {
  id: string;
  text: string;
  type: string;
  book_id?: string;
  scheduled_at: string;
  platforms?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('=== Starting Auto-Publish Job ===');
    console.log('Current time:', new Date().toISOString());

    // Get books that are ready to be published
    const { data: booksToPublish, error: fetchError } = await supabase
      .from('books')
      .select('*')
      .eq('published', false)
      .eq('auto_publish_enabled', true)
      .lte('scheduled_publish_at', new Date().toISOString())
      .order('scheduled_publish_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching books:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${booksToPublish?.length || 0} books ready to publish`);

    // Get campaign posts that are ready to be published
    const { data: campaignPostsToPublish, error: campaignFetchError } = await supabase
      .from('campaign_posts')
      .select(`
        *,
        book:books(id, code, title, image_url, sale_price, promotional_price)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (campaignFetchError) {
      console.error('Error fetching campaign posts:', campaignFetchError);
      throw campaignFetchError;
    }

    console.log(`Found ${campaignPostsToPublish?.length || 0} campaign posts ready to publish`);

    if ((!booksToPublish || booksToPublish.length === 0) && 
        (!campaignPostsToPublish || campaignPostsToPublish.length === 0)) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No content scheduled for publication',
          published: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // Publish each book
    for (const book of booksToPublish || []) {
      console.log(`Publishing book: ${book.title} (${book.code})`);
      
      try {
        // Call the publish-to-x function
        const { data, error: publishError } = await supabase.functions.invoke('publish-to-x', {
          body: { bookId: book.id }
        });

        if (publishError) {
          console.error(`Failed to publish book ${book.id}:`, publishError);
          results.push({
            id: book.id,
            type: 'book',
            title: book.title,
            success: false,
            error: publishError.message
          });
          failCount++;
        } else {
          console.log(`Successfully published book ${book.id}`);
          results.push({
            id: book.id,
            type: 'book',
            title: book.title,
            success: true
          });
          successCount++;
        }
      } catch (error: any) {
        console.error(`Error publishing book ${book.id}:`, error);
        results.push({
          id: book.id,
          type: 'book',
          title: book.title,
          success: false,
          error: error.message
        });
        failCount++;
      }
    }

    // Publish each campaign post to all its target platforms
    for (const post of campaignPostsToPublish || []) {
      console.log(`Publishing campaign post ${post.id} (${post.category}) to platforms:`, post.platforms || ['x']);
      
      const platforms: string[] = post.platforms || ['x'];
      const platformResults: Record<string, { success: boolean; error?: string; postId?: string }> = {};
      let allSucceeded = true;

      // Publish to each platform
      for (const platform of platforms) {
        try {
          if (platform === 'x') {
            const { data, error: publishError } = await supabase.functions.invoke('publish-to-x', {
              body: { 
                campaignPostId: post.id,
                bookId: post.book_id 
              }
            });

            if (publishError) {
              throw new Error(publishError.message || 'Failed to publish to X');
            }

            platformResults[platform] = { success: true, postId: data?.postId };
            console.log(`Successfully published to X for post ${post.id}`);
            
          } else if (platform === 'facebook') {
            const { data, error: publishError } = await supabase.functions.invoke('publish-to-facebook', {
              body: { 
                campaignPostId: post.id,
                bookId: post.book_id 
              }
            });

            if (publishError) {
              throw new Error(publishError.message || 'Failed to publish to Facebook');
            }

            platformResults[platform] = { success: true, postId: data?.postId };
            console.log(`Successfully published to Facebook for post ${post.id}`);
          }
        } catch (platformError: any) {
          console.error(`Failed to publish to ${platform} for post ${post.id}:`, platformError);
          platformResults[platform] = { 
            success: false, 
            error: platformError.message || 'Unknown error' 
          };
          allSucceeded = false;
        }
      }

      // Update post status based on results
      try {
        if (allSucceeded) {
          await supabase
            .from('campaign_posts')
            .update({ 
              status: 'published',
              published_at: new Date().toISOString()
            })
            .eq('id', post.id);
          
          results.push({
            id: post.id,
            type: 'campaign_post',
            title: `${post.category} - Day ${post.day}`,
            success: true,
            platforms: platformResults
          });
          successCount++;
          
        } else {
          // Check if at least one platform succeeded
          const anySuccess = Object.values(platformResults).some(r => r.success);
          
          await supabase
            .from('campaign_posts')
            .update({ 
              status: anySuccess ? 'partially_published' : 'failed'
            })
            .eq('id', post.id);
          
          results.push({
            id: post.id,
            type: 'campaign_post',
            title: `${post.category} - Day ${post.day}`,
            success: false,
            platforms: platformResults
          });
          failCount++;
        }
      } catch (updateError: any) {
        console.error(`Failed to update campaign post ${post.id}:`, updateError);
        results.push({
          id: post.id,
          type: 'campaign_post',
          title: `${post.category} - Day ${post.day}`,
          success: false,
          error: updateError.message || 'Failed to update status',
          platforms: platformResults
        });
        failCount++;
      }
    }

    console.log(`=== Auto-Publish Complete ===`);
    console.log(`Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        published: successCount,
        failed: failCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in auto-publish-books function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});