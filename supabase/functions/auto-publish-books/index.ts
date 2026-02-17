import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { File as MegaFile } from 'https://esm.sh/megajs@1.3.9';

const MEGA_REGEX = /^https?:\/\/mega\.nz\/(file|folder)\//;

async function resolveMegaUrl(
  videoUrl: string,
  postId: string,
  supabase: any,
  supabaseUrl: string
): Promise<{ resolvedUrl: string; tempPath: string | null }> {
  if (!MEGA_REGEX.test(videoUrl)) {
    return { resolvedUrl: videoUrl, tempPath: null };
  }

  console.log(`Resolving Mega.nz URL for post ${postId}...`);
  const tempPath = `temp-videos/${postId}-${Date.now()}.mp4`;

  const file = MegaFile.fromURL(videoUrl);
  await file.loadAttributes();
  const buffer = await file.downloadBuffer({});
  const blob = new Blob([new Uint8Array(buffer)], { type: 'video/mp4' });

  console.log(`Mega file downloaded (${(blob.size / 1024 / 1024).toFixed(1)} MB), uploading to temp storage...`);

  const { error } = await supabase.storage
    .from('ObrazkiKsiazek')
    .upload(tempPath, blob, { upsert: true });

  if (error) throw new Error(`Mega temp upload failed: ${error.message}`);

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${tempPath}`;
  console.log(`Mega resolved to temp URL: ${publicUrl}`);
  return { resolvedUrl: publicUrl, tempPath };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Book {
  id: string;
  code: string;
  title: string;
  image_url: string | null;
  storage_path: string | null;
  sale_price: number | null;
  promotional_price: number | null;
  video_url: string | null;
  video_storage_path: string | null;
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
  category?: string;
  book_id?: string;
  scheduled_at: string;
  platforms?: string[];
  target_accounts?: Record<string, string[]>; // Platform -> Account IDs array
  custom_image_url?: string; // Custom image/video URL from simple campaign
  campaign?: {
    id: string;
    user_id: string;
    target_platforms?: string[];
    status: string;
  };
  book?: Book;
}

// Helper to get token table name for platform
function getTokenTableName(platform: string): string {
  switch (platform) {
    case 'facebook': return 'facebook_oauth_tokens';
    case 'x': return 'twitter_oauth1_tokens';
    case 'instagram': return 'instagram_oauth_tokens';
    case 'youtube': return 'youtube_oauth_tokens';
    case 'linkedin': return 'linkedin_oauth_tokens';
    case 'tiktok': return 'tiktok_oauth_tokens';
    case 'telegram': return 'telegram_tokens';
    case 'bluesky': return 'bluesky_tokens';
    case 'mastodon': return 'mastodon_tokens';
    case 'gab': return 'gab_tokens';
    case 'pinterest': return 'pinterest_oauth_tokens';
    
    case 'discord': return 'discord_tokens';
    case 'tumblr': return 'tumblr_oauth_tokens';
    case 'google_business': return 'google_business_tokens';
    case 'google_business': return 'google_business_tokens';
    default: return '';
  }
}

// Helper to get platform display name in Polish
function getPlatformNamePL(platform: string): string {
  switch (platform) {
    case 'facebook': return 'Facebook';
    case 'x': return 'X (Twitter)';
    case 'instagram': return 'Instagram';
    case 'youtube': return 'YouTube';
    case 'linkedin': return 'LinkedIn';
    case 'tiktok': return 'TikTok';
    case 'telegram': return 'Telegram';
    case 'bluesky': return 'Bluesky';
    case 'mastodon': return 'Mastodon';
    case 'gab': return 'Gab';
    case 'pinterest': return 'Pinterest';
    
    case 'discord': return 'Discord';
    case 'tumblr': return 'Tumblr';
    case 'google_business': return 'Google Business';
    case 'google_business': return 'Google Business';
    default: return platform;
  }
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
    // Exclude books that are frozen from campaigns
    const { data: contentToPublish, error: fetchError } = await supabase
      .from('book_platform_content')
      .select(`
        *,
        book:books!inner(id, code, title, image_url, sale_price, promotional_price, exclude_from_campaigns)
      `)
      .eq('published', false)
      .eq('auto_publish_enabled', true)
      .eq('book.exclude_from_campaigns', false)
      .lte('scheduled_publish_at', new Date().toISOString())
      .order('scheduled_publish_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching book platform content:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${contentToPublish?.length || 0} book contents ready to publish`);

    // RACE CONDITION FIX: Immediately disable auto_publish to prevent duplicate processing
    if (contentToPublish && contentToPublish.length > 0) {
      const contentIds = contentToPublish.map(c => c.id);
      console.log(`Locking ${contentIds.length} book contents (setting auto_publish_enabled=false)`);
      await supabase
        .from('book_platform_content')
        .update({ auto_publish_enabled: false })
        .in('id', contentIds);
    }

    // Get campaign posts that are ready to be published (scheduled OR rate_limited with retry time passed)
    // Exclude posts from paused campaigns
    // IMPORTANT: Include campaign.user_id to know who owns the campaign!
    const now = new Date().toISOString();
    const { data: campaignPostsToPublish, error: campaignFetchError } = await supabase
      .from('campaign_posts')
      .select(`
        *,
        book:books(id, code, title, image_url, storage_path, sale_price, promotional_price, video_url, video_storage_path),
        campaign:campaigns!inner(id, user_id, target_platforms, status)
      `)
      .lte('scheduled_at', now)
      .neq('campaign.status', 'paused')
      .or(`status.eq.scheduled,and(status.eq.rate_limited,next_retry_at.lte.${now})`)
      .not('status', 'eq', 'publishing')
      .order('scheduled_at', { ascending: true });

    if (campaignFetchError) {
      console.error('Error fetching campaign posts:', campaignFetchError);
      throw campaignFetchError;
    }

    console.log(`Found ${campaignPostsToPublish?.length || 0} campaign posts ready to publish`);

    // RACE CONDITION FIX: Immediately mark campaign posts as "publishing" to prevent duplicate processing
    if (campaignPostsToPublish && campaignPostsToPublish.length > 0) {
      const postIds = campaignPostsToPublish.map(p => p.id);
      console.log(`Locking ${postIds.length} campaign posts (setting status=publishing)`);
      await supabase
        .from('campaign_posts')
        .update({ status: 'publishing' })
        .in('id', postIds);
    }

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
          case 'instagram':
            publishFunctionName = 'publish-to-instagram';
            break;
          case 'youtube':
            publishFunctionName = 'publish-to-youtube';
            break;
          case 'linkedin':
            publishFunctionName = 'publish-to-linkedin';
            break;
          case 'telegram':
            publishFunctionName = 'publish-to-telegram';
            break;
          case 'bluesky':
            publishFunctionName = 'publish-to-bluesky';
            break;
          case 'mastodon':
            publishFunctionName = 'publish-to-mastodon';
            break;
          case 'gab':
            publishFunctionName = 'publish-to-gab';
            break;
          case 'pinterest':
            publishFunctionName = 'publish-to-pinterest';
            break;
          case 'discord':
            publishFunctionName = 'publish-to-discord';
            break;
          case 'tumblr':
            publishFunctionName = 'publish-to-tumblr';
            break;
          case 'google_business':
            publishFunctionName = 'publish-to-google-business';
            break;
          case 'tiktok':
            publishFunctionName = 'publish-to-tiktok';
            break;
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
    for (const post of (campaignPostsToPublish || []) as CampaignPost[]) {
      console.log(`Publishing campaign post: ${post.id}`);
      
      // Get campaign owner's user_id - this is critical!
      const campaignOwnerId = post.campaign?.user_id;
      
      if (!campaignOwnerId) {
        console.error(`No campaign owner for post ${post.id}`);
        await supabase
          .from('campaign_posts')
          .update({
            status: 'failed',
            error_message: 'Nie można ustalić właściciela kampanii. Utwórz kampanię ponownie.',
            error_code: 'NO_CAMPAIGN_OWNER'
          })
          .eq('id', post.id);
        failCount++;
        results.push({
          id: post.id,
          type: 'campaign_post',
          success: false,
          error: 'No campaign owner'
        });
        continue;
      }
      
      try {
        const platforms = post.platforms || ['x'];
        const targetAccounts = post.target_accounts || {};
        let platformSuccessCount = 0;
        let platformFailCount = 0;
        const platformErrors: string[] = [];
        
        // Pre-compute video URL once for this post (same across all platforms/accounts)
        const bookVideoUrlRaw = post.book?.video_url || 
          (post.book?.video_storage_path ? `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${post.book.video_storage_path}` : null);
        
        // Resolve Mega.nz URL once before publishing to any platform
        let resolvedVideoUrl = bookVideoUrlRaw;
        let tempMegaPath: string | null = null;
        if (resolvedVideoUrl && MEGA_REGEX.test(resolvedVideoUrl)) {
          try {
            const resolved = await resolveMegaUrl(resolvedVideoUrl, post.id, supabase, supabaseUrl);
            resolvedVideoUrl = resolved.resolvedUrl;
            tempMegaPath = resolved.tempPath;
          } catch (megaErr: any) {
            console.error(`Mega.nz resolution failed for post ${post.id}:`, megaErr.message);
            await supabase
              .from('campaign_posts')
              .update({
                status: 'failed',
                error_message: `Nie udało się pobrać wideo z Mega.nz: ${megaErr.message}. Użyj mniejszego pliku lub bezpośredniego linku .mp4.`,
                error_code: 'MEGA_DOWNLOAD_FAILED'
              })
              .eq('id', post.id);
            failCount++;
            results.push({ id: post.id, type: 'campaign_post', success: false, error: megaErr.message });
            continue; // skip this entire post
          }
        }
        
        for (const platform of platforms) {
          let publishFunctionName = '';
          
          switch (platform) {
            case 'x':
              publishFunctionName = 'publish-to-x';
              break;
            case 'facebook':
              publishFunctionName = 'publish-to-facebook';
              break;
            case 'instagram':
              publishFunctionName = 'publish-to-instagram';
              break;
            case 'youtube':
              publishFunctionName = 'publish-to-youtube';
              break;
            case 'linkedin':
              publishFunctionName = 'publish-to-linkedin';
              break;
            case 'telegram':
              publishFunctionName = 'publish-to-telegram';
              break;
            case 'bluesky':
              publishFunctionName = 'publish-to-bluesky';
              break;
            case 'mastodon':
              publishFunctionName = 'publish-to-mastodon';
              break;
            case 'gab':
              publishFunctionName = 'publish-to-gab';
              break;
            case 'pinterest':
              publishFunctionName = 'publish-to-pinterest';
              break;
            case 'discord':
              publishFunctionName = 'publish-to-discord';
              break;
            case 'tumblr':
              publishFunctionName = 'publish-to-tumblr';
              break;
            case 'google_business':
              publishFunctionName = 'publish-to-google-business';
              break;
            case 'tiktok':
              publishFunctionName = 'publish-to-tiktok';
              break;
            default:
              console.error(`No publish function for platform: ${platform}`);
              platformErrors.push(`Platforma ${platform} nie jest jeszcze obsługiwana.`);
              platformFailCount++;
              continue;
          }

          // Get selected accounts for this platform from target_accounts
          let accountsForPlatform = targetAccounts[platform] || [];
          
          // If no specific accounts selected, get ALL accounts for the campaign owner
          if (accountsForPlatform.length === 0) {
            console.log(`No target_accounts for ${platform}, fetching all accounts for campaign owner ${campaignOwnerId}`);
            
            const tableName = getTokenTableName(platform);
            if (tableName) {
              const { data: ownerAccounts, error: accountsError } = await supabase
                .from(tableName)
                .select('id')
                .eq('user_id', campaignOwnerId);
              
              if (accountsError) {
                console.error(`Error fetching ${platform} accounts for owner:`, accountsError);
              } else if (ownerAccounts && ownerAccounts.length > 0) {
                accountsForPlatform = ownerAccounts.map(a => a.id);
                console.log(`Found ${accountsForPlatform.length} ${platform} accounts for campaign owner`);
              }
            }
          }
          
          // If still no accounts, mark as failed
          if (accountsForPlatform.length === 0) {
            console.error(`No accounts found for platform ${platform} for user ${campaignOwnerId}`);
            const platformName = getPlatformNamePL(platform);
            platformErrors.push(`Brak połączonego konta ${platformName}. Połącz konto w ustawieniach.`);
            platformFailCount++;
            continue;
          }
          
          // Multi-account publishing: iterate over accounts
          console.log(`Publishing to ${accountsForPlatform.length} accounts on ${platform}`);
          let accountSuccessCount = 0;
          const accountErrors: string[] = [];
          
          for (const accountId of accountsForPlatform) {
            console.log(`Publishing to account ${accountId} on ${platform}`);
            
            // Get the owner of THIS specific account (should be campaignOwnerId, but verify)
            const tableName = getTokenTableName(platform);
            const { data: accountData } = await supabase
              .from(tableName)
              .select('user_id')
              .eq('id', accountId)
              .single();
            
            const accountOwnerId = accountData?.user_id || campaignOwnerId;
            
            // Priority: custom_image_url > Supabase Storage > external image_url
            // Supabase Storage URLs are publicly accessible and work with Instagram/Facebook servers
            const storageUrl = post.book?.storage_path 
              ? `${supabaseUrl}/storage/v1/object/public/ObrazkiKsiazek/${post.book.storage_path}` 
              : null;
            const mediaUrl = post.custom_image_url || storageUrl || post.book?.image_url || null;
            
            // For video: use pre-resolved video URL (Mega already handled above)
            // Detect if mediaUrl is a video based on extension
            const isMediaVideo = mediaUrl ? /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(mediaUrl) : false;
            
            // Final video URL: if mediaUrl is video use it, otherwise use the pre-resolved book video
            const videoUrl = isMediaVideo ? mediaUrl : resolvedVideoUrl;
            const imageUrl = isMediaVideo ? null : mediaUrl;
            
            console.log(`Media for post ${post.id}: image=${imageUrl ? 'present' : 'none'}, video=${videoUrl ? 'present' : 'none'}`);
            
            const { data, error: publishError } = await supabase.functions.invoke(publishFunctionName, {
              body: { 
                bookId: post.book_id || post.book?.id,  // Pass bookId for platforms that need it
                campaignPostId: post.id,
                platform: platform,
                userId: accountOwnerId,
                accountId: accountId,
                imageUrl: imageUrl,
                videoUrl: videoUrl
              }
            });

            // Check for errors from both invoke error and response data
            const hasInvokeError = !!publishError;
            const hasResponseError = data && data.success === false;
            const actualError = hasInvokeError || hasResponseError;

            if (actualError) {
              const errorMsg = data?.message || data?.error || publishError?.message || 'Nieznany błąd';
              console.error(`Failed to publish campaign post ${post.id} to ${platform} account ${accountId}:`, errorMsg);
              
              // Check if it's a rate limit error
              const isRateLimitError = errorMsg?.includes('429') || 
                errorMsg?.includes('Too Many Requests') ||
                errorMsg?.includes('rate limit') ||
                data?.error === 'rate_limit' ||
                data?.errorCode === 'RATE_LIMITED';
              
              if (!isRateLimitError) {
                accountErrors.push(`Konto ${accountId.substring(0, 8)}: ${errorMsg}`);
              }
              // Continue to next account even if this one failed
            } else {
              console.log(`Successfully published campaign post ${post.id} to ${platform} account ${accountId}`);
              accountSuccessCount++;
            }
          }
          
          // Consider platform successful if at least one account succeeded
          if (accountSuccessCount > 0) {
            platformSuccessCount++;
          } else {
            platformFailCount++;
            const platformName = getPlatformNamePL(platform);
            if (accountErrors.length > 0) {
              platformErrors.push(`${platformName}: ${accountErrors.join('; ')}`);
            } else {
              platformErrors.push(`${platformName}: Nie udało się opublikować na żadne konto.`);
            }
          }
        }

        // Clean up any temp Mega files after all platforms are done
        if (tempMegaPath) {
          try {
            await supabase.storage.from('ObrazkiKsiazek').remove([tempMegaPath]);
            console.log(`Cleaned up temp Mega file: ${tempMegaPath}`);
          } catch (cleanupErr) {
            console.warn(`Failed to cleanup temp Mega file ${tempMegaPath}:`, cleanupErr);
          }
        }

        // Only update status to published if ALL platforms succeeded
        const allPlatformsSucceeded = platformSuccessCount > 0 && platformFailCount === 0;
        
        if (allPlatformsSucceeded) {
          const { error: updateError } = await supabase
            .from('campaign_posts')
            .update({
              status: 'published',
              published_at: new Date().toISOString(),
              error_message: null, // Clear any previous error
              error_code: null
            })
            .eq('id', post.id);

          if (updateError) {
            console.error(`Error updating campaign post status:`, updateError);
          }

          // Update book statistics if this is a sales post
          if (post.type === 'sales' && post.book_id) {
            console.log(`Updating statistics for book ${post.book_id}`);
            
            // Fetch current book data
            const { data: bookData, error: fetchBookError } = await supabase
              .from('books')
              .select('campaign_post_count')
              .eq('id', post.book_id)
              .single();

            if (!fetchBookError && bookData) {
              const { error: bookUpdateError } = await supabase
                .from('books')
                .update({
                  campaign_post_count: (bookData.campaign_post_count || 0) + 1,
                  last_campaign_date: new Date().toISOString()
                })
                .eq('id', post.book_id);

              if (bookUpdateError) {
                console.error(`Error updating book statistics:`, bookUpdateError);
              }
            }
          }

          // Save content post to history for deduplication
          if (post.type === 'content') {
            console.log(`Saving content post ${post.id} to history for platforms:`, platforms);
            
            // Save to history for each platform
            for (const platform of platforms) {
              const { error: historyError } = await supabase
                .from('campaign_content_history')
                .insert({
                  campaign_post_id: post.id,
                  platform: platform,
                  category: post.category || 'unknown',
                  topic_summary: post.text.substring(0, 150),
                  full_text: post.text,
                  user_id: campaignOwnerId
                });

              if (historyError) {
                console.error(`Error saving content history for ${platform}:`, historyError);
              }
            }
          }
          
          successCount++;
          results.push({
            id: post.id,
            type: 'campaign_post',
            platforms: platforms,
            success: true
          });
        } else if (platformFailCount > 0) {
          // Mark as failed with detailed error message
          const errorMessage = platformErrors.length > 0 
            ? platformErrors.join(' | ')
            : `Nie udało się opublikować na ${platformFailCount} z ${platforms.length} platform.`;
          
          const { error: updateError } = await supabase
            .from('campaign_posts')
            .update({
              status: 'failed',
              error_message: errorMessage,
              error_code: 'PUBLISH_FAILED'
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
            error: errorMessage
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
              error_message: error.message || 'Wystąpił nieoczekiwany błąd podczas publikacji.',
              error_code: 'UNEXPECTED_ERROR'
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
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
