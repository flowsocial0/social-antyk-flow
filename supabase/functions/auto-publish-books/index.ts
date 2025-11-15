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

interface BookPlatformContent {
  id: string;
  book_id: string;
  platform: string;
  ai_generated_text: string | null;
  published: boolean;
  scheduled_publish_at: string;
  book?: Book;
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

    // Get book platform content that is ready to be published
    const { data: contentToPublish, error: fetchError } = await supabase
      .from('book_platform_content')
      .select(`
        *,
        book:books(id, code, title, image_url, sale_price, promotional_price)
      `)
      .eq('published', false)
      .eq('auto_publish_enabled', true)
      .lte('scheduled_publish_at', new Date().toISOString())
      .order('scheduled_publish_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching book platform content:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${contentToPublish?.length || 0} book contents ready to publish`);

    // Get campaign posts that are ready to be published (scheduled OR rate_limited with retry time passed)
    const now = new Date().toISOString();
    const { data: campaignPostsToPublish, error: campaignFetchError } = await supabase
      .from('campaign_posts')
      .select(`
        *,
        book:books(id, code, title, image_url, sale_price, promotional_price)
      `)
      .lte('scheduled_at', now)
      .or(`status.eq.scheduled,and(status.eq.rate_limited,next_retry_at.lte.${now})`)
      .order('scheduled_at', { ascending: true });

    if (campaignFetchError) {
      console.error('Error fetching campaign posts:', campaignFetchError);
      throw campaignFetchError;
    }

    console.log(`Found ${campaignPostsToPublish?.length || 0} campaign posts ready to publish`);

    if ((!contentToPublish || contentToPublish.length === 0) && 
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

    // Publish each book platform content
    for (const content of contentToPublish || []) {
      const book = content.book as Book;
      console.log(`Publishing ${content.platform} content for book: ${book.title} (${book.code})`);
      
      try {
        let publishFunctionName = '';
        
        // Determine which publish function to call based on platform
        switch (content.platform) {
          case 'x':
            publishFunctionName = 'publish-to-x';
            break;
          case 'facebook':
            publishFunctionName = 'publish-to-facebook';
            break;
          // Add more platforms as they are implemented
          default:
            console.error(`No publish function for platform: ${content.platform}`);
            results.push({
              id: content.id,
              type: 'book_content',
              platform: content.platform,
              title: book.title,
              success: false,
              error: `Platform ${content.platform} not supported yet`
            });
            failCount++;
            continue;
        }

        // Call the appropriate publish function
        const { data, error: publishError } = await supabase.functions.invoke(publishFunctionName, {
          body: { 
            bookId: book.id,
            contentId: content.id,
            platform: content.platform
          }
        });

        if (publishError) {
          console.error(`Failed to publish ${content.platform} content ${content.id}:`, publishError);
          results.push({
            id: content.id,
            type: 'book_content',
            platform: content.platform,
            title: book.title,
            success: false,
            error: publishError.message
          });
          failCount++;
        } else {
          console.log(`Successfully published ${content.platform} content ${content.id}`);
          
          // Update the book_platform_content record
          await supabase
            .from('book_platform_content')
            .update({
              published: true,
              published_at: new Date().toISOString(),
              post_id: data?.postId
            })
            .eq('id', content.id);

          results.push({
            id: content.id,
            type: 'book_content',
            platform: content.platform,
            title: book.title,
            success: true,
            postId: data?.postId
          });
          successCount++;
        }
      } catch (error: any) {
        console.error(`Error publishing ${content.platform} content ${content.id}:`, error);
        results.push({
          id: content.id,
          type: 'book_content',
          platform: content.platform,
          title: book.title,
          success: false,
          error: error.message
        });
        failCount++;
      }
    }

    // Publish campaign posts
    for (const post of campaignPostsToPublish || []) {
      console.log(`Publishing campaign post: ${post.id}`);
      
      try {
        const platforms = post.platforms || ['x'];
        let platformSuccessCount = 0;
        let platformFailCount = 0;
        
        for (const platform of platforms) {
          let publishFunctionName = '';
          
          switch (platform) {
            case 'x':
              publishFunctionName = 'publish-to-x';
              break;
            case 'facebook':
              publishFunctionName = 'publish-to-facebook';
              break;
            default:
              console.error(`No publish function for platform: ${platform}`);
              platformFailCount++;
              continue;
          }

          const { data, error: publishError } = await supabase.functions.invoke(publishFunctionName, {
            body: { 
              campaignPostId: post.id,
              platform: platform
            }
          });

          if (publishError) {
            console.error(`Failed to publish campaign post ${post.id} to ${platform}:`, publishError);
            
            // Check if it's a rate limit error - if so, the publish function already updated the status
            const isRateLimitError = publishError.message?.includes('429') || 
              publishError.message?.includes('Too Many Requests') ||
              data?.error === 'rate_limit';
            
            if (!isRateLimitError) {
              platformFailCount++;
            }
            // For rate limit errors, don't count as failure - let the retry mechanism handle it
          } else {
            console.log(`Successfully published campaign post ${post.id} to ${platform}`);
            platformSuccessCount++;
          }
        }

        // Only update status to published if ALL platforms succeeded
        const allPlatformsSucceeded = platformSuccessCount > 0 && platformFailCount === 0;
        
        if (allPlatformsSucceeded) {
          const { error: updateError } = await supabase
            .from('campaign_posts')
            .update({
              status: 'published',
              published_at: new Date().toISOString()
            })
            .eq('id', post.id);

          if (updateError) {
            console.error(`Error updating campaign post status:`, updateError);
          }
          
          successCount++;
          results.push({
            id: post.id,
            type: 'campaign_post',
            platforms: platforms,
            success: true
          });
        } else if (platformFailCount > 0) {
          // Only mark as failed if there were actual failures (not rate limits)
          // Rate limit errors are already handled by the publish function
          const { error: updateError } = await supabase
            .from('campaign_posts')
            .update({
              status: 'failed'
            })
            .eq('id', post.id);

          if (updateError) {
            console.error(`Error updating campaign post status to failed:`, updateError);
          }
          
          failCount++;
          results.push({
            id: post.id,
            type: 'campaign_post',
            platforms: platforms,
            success: false,
            error: `Failed to publish to ${platformFailCount} of ${platforms.length} platforms`
          });
        }

      } catch (error: any) {
        console.error(`Error publishing campaign post ${post.id}:`, error);
        
        // Check if it's a rate limit error - if so, don't override status (publish function already handled it)
        const isRateLimitError = error.message?.includes('429') || 
          error.message?.includes('Too Many Requests') ||
          error.message?.includes('rate limit');
        
        if (!isRateLimitError) {
          // Mark post as failed only for non-rate-limit errors
          await supabase
            .from('campaign_posts')
            .update({
              status: 'failed',
              error_message: error.message
            })
            .eq('id', post.id);
          
          failCount++;
        }
        
        results.push({
          id: post.id,
          type: 'campaign_post',
          success: false,
          error: error.message,
          is_rate_limit: isRateLimitError
        });
      }
    }

    console.log(`=== Auto-Publish Job Complete ===`);
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

  } catch (error) {
    console.error('Error in auto-publish function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
