import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  
  // Dynamic import to avoid build failures when megajs is unavailable
  let MegaFile: any;
  try {
    const megaModule = await import('https://esm.sh/megajs@1.3.9');
    MegaFile = megaModule.File;
  } catch (err: any) {
    throw new Error(`Mega.nz resolver unavailable: ${err.message}. Use a direct .mp4 URL instead.`);
  }
  
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
    
    
    case 'discord': return 'Discord';
    case 'tumblr': return 'Tumblr';
    case 'google_business': return 'Google Business';
    case 'google_business': return 'Google Business';
    default: return platform;
  }
}

// Platform rate limits: max posts per account per time window
const PLATFORM_RATE_LIMITS: Record<string, { maxPosts: number; windowMinutes: number }> = {
  x: { maxPosts: 100, windowMinutes: 1 },        // internal anti-spam throttle
  instagram: { maxPosts: 100, windowMinutes: 1 }, // IG throttles aggressively
  facebook: { maxPosts: 100, windowMinutes: 1 },  // FB anti-spam
  linkedin: { maxPosts: 100, windowMinutes: 1 },  // LinkedIn daily limit
  tiktok: { maxPosts: 100, windowMinutes: 1 }, 
  youtube: { maxPosts: 100, windowMinutes: 1 }, 
   
  // No limits for self-hosted: telegram, discord, bluesky, mastodon, gab, tumblr, google_business
};

const RATE_LIMIT_ERROR_PATTERNS = [
  'too many actions', 'throttle', 'ograniczamy liczbę', 'rate limit',
  '429', 'Too Many Requests', 'spam', 'try again later',
  'limit exceeded', 'Please wait', 'slow down',
  'DAILY_LIMIT', 'X_API_DAILY_LIMIT',
  'APPLICATION_AND_MEMBER DAY', 'member day', 'application day',
  'zbyt wiele', 'za dużo', 'poczekaj', 'spróbuj później',
  'too many requests', 'too_many_requests', 'temporarily blocked',
  'User request limit reached', 'quota', 'exceeded the rate limit',
  '15/15 dzienny limit', 'dzienny limit',
];

// Permanent (non-recoverable until user acts) error patterns — do NOT retry
const PERMANENT_ERROR_PATTERNS = [
  'CreditsDepleted', 'credits depleted', 'X_CREDITS_DEPLETED',
  '402', 'does not have any credits',
];

function isPermanentErrorMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return PERMANENT_ERROR_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

function isRateLimitErrorMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return RATE_LIMIT_ERROR_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

// Token tables that have expires_at column
const TABLES_WITH_EXPIRY = ['facebook_oauth_tokens', 'instagram_oauth_tokens', 'linkedin_oauth_tokens', 
  'tiktok_oauth_tokens', 'youtube_oauth_tokens', 'google_business_tokens', 'tumblr_oauth_tokens'];

// Try to find a replacement account when the original account ID no longer exists
// This happens when a user reconnects their social account (new token row with new UUID)
async function tryRemapOrphanedAccount(
  supabase: any,
  platform: string,
  oldAccountId: string,
  userId: string
): Promise<{ newAccountId: string | null; remapped: boolean }> {
  const tableName = getTokenTableName(platform);
  if (!tableName) return { newAccountId: null, remapped: false };

  // Check if old account exists
  const { data: oldAccount } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', oldAccountId)
    .maybeSingle();

  if (oldAccount) {
    // Account still exists, no remap needed
    return { newAccountId: oldAccountId, remapped: false };
  }

  // Account doesn't exist - try to find a replacement for the same user
  console.log(`🔄 Account ${oldAccountId.substring(0,8)} not found for ${platform}, attempting auto-remap for user ${userId.substring(0,8)}`);
  
  const { data: userAccounts, error } = await supabase
    .from(tableName)
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !userAccounts || userAccounts.length === 0) {
    console.log(`❌ No replacement ${platform} account found for user ${userId.substring(0,8)}`);
    return { newAccountId: null, remapped: false };
  }

  const newId = userAccounts[0].id;
  console.log(`✅ Auto-remapped ${platform}: ${oldAccountId.substring(0,8)} → ${newId.substring(0,8)}`);
  return { newAccountId: newId, remapped: true };
}

// Update campaign and post references after successful remap
async function persistAccountRemap(
  supabase: any,
  postId: string,
  campaignId: string,
  platform: string,
  oldAccountId: string,
  newAccountId: string
): Promise<void> {
  try {
    // Update target_accounts in the campaign_post
    const { data: post } = await supabase
      .from('campaign_posts')
      .select('target_accounts')
      .eq('id', postId)
      .single();

    if (post?.target_accounts) {
      const ta = post.target_accounts as Record<string, string[]>;
      if (ta[platform]) {
        ta[platform] = ta[platform].map((id: string) => id === oldAccountId ? newAccountId : id);
        await supabase
          .from('campaign_posts')
          .update({ target_accounts: ta })
          .eq('id', postId);
      }
    }

    // Also update campaigns.selected_accounts
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('selected_accounts')
      .eq('id', campaignId)
      .single();

    if (campaign?.selected_accounts) {
      const sa = campaign.selected_accounts as Record<string, string[]>;
      if (sa[platform]) {
        sa[platform] = sa[platform].map((id: string) => id === oldAccountId ? newAccountId : id);
        await supabase
          .from('campaigns')
          .update({ selected_accounts: sa })
          .eq('id', campaignId);
      }
    }

    console.log(`💾 Persisted remap for ${platform}: ${oldAccountId.substring(0,8)} → ${newAccountId.substring(0,8)} in post ${postId.substring(0,8)} and campaign ${campaignId.substring(0,8)}`);
  } catch (err: any) {
    console.warn(`Warning: failed to persist remap: ${err.message}`);
  }
}

// Pre-publish validation: check if a specific account token is still valid
async function validateAccountToken(
  supabase: any, 
  platform: string, 
  accountId: string
): Promise<{ valid: boolean; reason?: string }> {
  const tableName = getTokenTableName(platform);
  if (!tableName) return { valid: false, reason: 'Nieznana platforma' };
  
  const { data: account, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', accountId)
    .maybeSingle();
  
  if (error || !account) {
    return { valid: false, reason: `Konto nie istnieje. Połącz ponownie w ustawieniach.` };
  }
  
  // Check token expiry for platforms that have it
  if (TABLES_WITH_EXPIRY.includes(tableName) && account.expires_at) {
    const expiresAt = new Date(account.expires_at);
    if (expiresAt < new Date()) {
      return { valid: false, reason: `Token ${getPlatformNamePL(platform)} wygasł. Połącz konto ponownie.` };
    }
  }
  
  // Check if access_token exists
  if (!account.access_token && !account.oauth_token && !account.bot_token && !account.app_password && !account.webhook_url) {
    return { valid: false, reason: `Brak tokenu autoryzacji. Połącz konto ponownie.` };
  }
  
  return { valid: true };
}

// Check how many posts were published for a given user+platform in the last N minutes
// Uses platform_publications which is NOW populated centrally after each successful publish
async function checkUserPlatformRateLimit(
  supabase: any,
  userId: string,
  platform: string,
  windowMinutes: number
): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('platform_publications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('platform', platform)
    .gte('published_at', since);
  
  if (error) {
    console.warn(`Error checking rate limit for ${platform}/user ${userId}:`, error.message);
    return 0;
  }
  console.log(`Rate limit check: ${platform} user ${userId.substring(0,8)} = ${count || 0} posts in last ${windowMinutes}min`);
  return count || 0;
}

// Global per-cycle counters to enforce max posts per platform per user per cron run
const cyclePublishCounts: Record<string, number> = {};
const MAX_PER_CYCLE = 3; // max 3 posts per platform per user per 2-min cron cycle

function getCycleKey(userId: string, platform: string): string {
  return `${userId}:${platform}`;
}

function canPublishInCycle(userId: string, platform: string): boolean {
  const key = getCycleKey(userId, platform);
  return (cyclePublishCounts[key] || 0) < MAX_PER_CYCLE;
}

function recordCyclePublish(userId: string, platform: string): void {
  const key = getCycleKey(userId, platform);
  cyclePublishCounts[key] = (cyclePublishCounts[key] || 0) + 1;
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
    //
    // FAIRNESS + BACKPRESSURE: pobieramy maks. 200 kandydatów, a potem ograniczamy
    // do MAX_POSTS_PER_CYCLE łącznie i MAX_POSTS_PER_CAMPAIGN_PER_CYCLE per kampania,
    // żeby jedna stara kampania z setkami zaległości nie blokowała świeższych kampanii.
    const MAX_POSTS_PER_CYCLE = 25;
    const MAX_POSTS_PER_CAMPAIGN_PER_CYCLE = 3;
    const now = new Date().toISOString();
    const { data: candidatePosts, error: campaignFetchError } = await supabase
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
      .order('scheduled_at', { ascending: true })
      .limit(200);

    if (campaignFetchError) {
      console.error('Error fetching campaign posts:', campaignFetchError);
      throw campaignFetchError;
    }

    // Fair scheduling: round-robin po kampaniach, max N per kampania, max M ogółem
    const perCampaignCount: Record<string, number> = {};
    const campaignPostsToPublish: any[] = [];
    for (const p of (candidatePosts || [])) {
      const cid = (p as any).campaign?.id || (p as any).campaign_id;
      if (!cid) continue;
      const cnt = perCampaignCount[cid] || 0;
      if (cnt >= MAX_POSTS_PER_CAMPAIGN_PER_CYCLE) continue;
      perCampaignCount[cid] = cnt + 1;
      campaignPostsToPublish.push(p);
      if (campaignPostsToPublish.length >= MAX_POSTS_PER_CYCLE) break;
    }

    console.log(`Candidates: ${candidatePosts?.length || 0}, picked ${campaignPostsToPublish.length} for this cycle (cap ${MAX_POSTS_PER_CYCLE} total, ${MAX_POSTS_PER_CAMPAIGN_PER_CYCLE}/campaign)`);

    // RACE CONDITION FIX: Immediately mark campaign posts as "publishing" to prevent duplicate processing
    if (campaignPostsToPublish.length > 0) {
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

    // Track accounts that returned a permanent error (e.g. X CreditsDepleted) within this cycle —
    // skip them for the rest of the cycle to avoid hammering the API and spamming logs.
    const depletedAccountsThisCycle = new Set<string>(); // key: `${platform}:${accountId}`

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
          // ====== PRE-PLATFORM RATE LIMIT CHECK (before account loop) ======
          const rateLimit = PLATFORM_RATE_LIMITS[platform];
          if (rateLimit) {
            const recentCount = await checkUserPlatformRateLimit(supabase, campaignOwnerId, platform, rateLimit.windowMinutes);
            if (recentCount >= rateLimit.maxPosts) {
              console.log(`⛔ Rate limit reached for ${platform} user ${campaignOwnerId.substring(0,8)}: ${recentCount}/${rateLimit.maxPosts} in ${rateLimit.windowMinutes}min — skipping entire post`);
              const retryAt = new Date(Date.now() + rateLimit.windowMinutes * 60 * 1000).toISOString();
              await supabase
                .from('campaign_posts')
                .update({
                  status: 'rate_limited',
                  next_retry_at: retryAt,
                  error_message: `Limit platformy ${getPlatformNamePL(platform)}: ${recentCount}/${rateLimit.maxPosts} postów w ${rateLimit.windowMinutes} min. Automatyczna ponowna próba o ${new Date(retryAt).toLocaleTimeString('pl-PL')}.`,
                  error_code: 'RATE_LIMITED'
                })
                .eq('id', post.id);
              platformErrors.push(`${getPlatformNamePL(platform)}: limit, retry za ${rateLimit.windowMinutes} min`);
              platformFailCount++;
              continue; // skip to next platform
            }
          }
          
          // ====== PER-CYCLE LIMIT CHECK ======
          if (!canPublishInCycle(campaignOwnerId, platform)) {
            console.log(`⛔ Cycle limit reached for ${platform} user ${campaignOwnerId.substring(0,8)} (max ${MAX_PER_CYCLE} per cron run)`);
            const retryAt = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // retry in 3 min (next cron)
            await supabase
              .from('campaign_posts')
              .update({
                status: 'rate_limited',
                next_retry_at: retryAt,
                error_message: `Limit cyklu: max ${MAX_PER_CYCLE} posty/${platform} na cykl. Automatycznie za 3 min.`,
                error_code: 'CYCLE_LIMITED'
              })
              .eq('id', post.id);
            platformErrors.push(`${getPlatformNamePL(platform)}: limit cyklu`);
            platformFailCount++;
            continue;
          }

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
          // Dedupe — w danych zdarzają się powtórzone UUIDs (np. facebook 5x ten sam page),
          // co powoduje publikację tego samego posta wiele razy i natychmiastowy rate-limit.
          accountsForPlatform = [...new Set(accountsForPlatform.filter(Boolean))];
          
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
                accountsForPlatform = [...new Set(ownerAccounts.map(a => a.id))];
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
          let accountRateLimitedCount = 0;
          
          for (let accountId of accountsForPlatform) {
            // Skip accounts already known to be out of credits / permanently failing in this cycle
            if (depletedAccountsThisCycle.has(`${platform}:${accountId}`)) {
              console.log(`⏭️ Skipping ${platform} account ${accountId.substring(0,8)} — marked as depleted in this cycle`);
              accountErrors.push(`Konto ${accountId.substring(0, 8)}: brak kredytów na X (pominięto w tym cyklu)`);
              continue;
            }
            console.log(`Publishing to account ${accountId} on ${platform}`);
            
            // ====== AUTO-REMAP ORPHANED ACCOUNTS ======
            const remap = await tryRemapOrphanedAccount(supabase, platform, accountId, campaignOwnerId);
            if (remap.remapped && remap.newAccountId) {
              // Successfully remapped to a new account
              await persistAccountRemap(supabase, post.id, post.campaign?.id || '', platform, accountId, remap.newAccountId);
              accountId = remap.newAccountId;
            } else if (!remap.newAccountId && !remap.remapped) {
              // Old account gone, no replacement found — check if it truly doesn't exist
              const tokenValidation = await validateAccountToken(supabase, platform, accountId);
              if (!tokenValidation.valid) {
                console.error(`⛔ Account ${accountId} invalid and no replacement: ${tokenValidation.reason}`);
                accountErrors.push(`Konto ${accountId.substring(0, 8)}: ${tokenValidation.reason}`);
                continue;
              }
            }
            
            // ====== PRE-PUBLISH TOKEN VALIDATION ======
            const tokenValidation = await validateAccountToken(supabase, platform, accountId);
            if (!tokenValidation.valid) {
              console.error(`⛔ Account ${accountId} invalid: ${tokenValidation.reason}`);
              accountErrors.push(`Konto ${accountId.substring(0, 8)}: ${tokenValidation.reason}`);
              continue; // skip to next account
            }
            
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
              
              // Permanent errors (e.g. X CreditsDepleted 402) — don't retry, mark account depleted for this cycle
              const isPermanentError = isPermanentErrorMessage(errorMsg) ||
                data?.errorCode === 'X_CREDITS_DEPLETED' ||
                data?.errorCode === 'CREDITS_DEPLETED';

              // Check if it's a rate limit error (expanded patterns) — only if not permanent
              const isRateLimitError = !isPermanentError && (
                isRateLimitErrorMessage(errorMsg) ||
                data?.error === 'rate_limit' ||
                data?.errorCode === 'RATE_LIMITED' ||
                data?.errorCode === 'DAILY_LIMIT' ||
                data?.errorCode === 'X_API_DAILY_LIMIT'
              );

              if (isPermanentError) {
                console.error(`⛔ Permanent error for ${platform} account ${accountId.substring(0,8)} — flagging depleted, no retry: ${errorMsg}`);
                depletedAccountsThisCycle.add(`${platform}:${accountId}`);
                accountErrors.push(`Konto ${accountId.substring(0, 8)}: brak kredytów na X — doładuj konto na developer.x.com`);
              } else if (isRateLimitError) {
                // Track rate-limited accounts separately — don't treat as hard failure
                console.log(`Rate limit detected for ${platform} account ${accountId}, will set rate_limited`);
                accountRateLimitedCount++;
                // Preserve the next_retry_at from publish-to-x if it was set
              } else {
                accountErrors.push(`Konto ${accountId.substring(0, 8)}: ${errorMsg}`);
              }
              // Continue to next account even if this one failed
            } else {
              console.log(`✅ Successfully published campaign post ${post.id} to ${platform} account ${accountId}`);
              accountSuccessCount++;
              
              // Record in platform_publications for accurate rate limiting
              const { error: pubInsertError } = await supabase
                .from('platform_publications')
                .insert({
                  user_id: campaignOwnerId,
                  account_id: accountId,
                  platform: platform,
                  campaign_post_id: post.id,
                  book_id: post.book_id || null,
                  post_id: data?.postId || null,
                  published_at: new Date().toISOString(),
                  source: 'campaign',
                  quota_cost: 1
                });
              
              if (pubInsertError) {
                console.warn(`Failed to record publication for rate limiting:`, pubInsertError.message);
              }
              
              // Record in cycle counter
              recordCyclePublish(campaignOwnerId, platform);
            }
          }
          
          // Consider platform successful if at least one account succeeded
          if (accountSuccessCount > 0) {
            platformSuccessCount++;
          } else if (accountRateLimitedCount > 0 && accountErrors.length === 0) {
            // ALL failures were rate-limits — don't count as hard failure
            // The post status was already set to rate_limited by publish-to-x
            // We must NOT overwrite it later with "failed"
            console.log(`⏳ Platform ${platform}: all ${accountRateLimitedCount} accounts rate-limited, preserving rate_limited status`);
            // Don't increment platformFailCount — skip to preserve rate_limited
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
          // Before overwriting, check if publish-to-x already set rate_limited
          const { data: currentPostState } = await supabase
            .from('campaign_posts')
            .select('status, next_retry_at')
            .eq('id', post.id)
            .single();
          
          if (currentPostState?.status === 'rate_limited' && currentPostState?.next_retry_at) {
            // publish-to-x already set the correct rate_limited status with retry time
            // Do NOT overwrite it with 'failed'
            console.log(`⏳ Post ${post.id} already rate_limited by publish function, preserving status (retry at ${currentPostState.next_retry_at})`);
            results.push({
              id: post.id,
              type: 'campaign_post',
              platforms: platforms,
              success: false,
              error: 'rate_limited',
              is_rate_limit: true
            });
          } else {
            // Mark as failed with detailed error message
            const errorMessage = platformErrors.length > 0 
              ? platformErrors.join(' | ')
              : `Nie udało się opublikować na ${platformFailCount} z ${platforms.length} platform.`;
            
            // Check if the error is rate-limit related → use rate_limited instead of failed
            const isRateError = isRateLimitErrorMessage(errorMessage);
            const newStatus = isRateError ? 'rate_limited' : 'failed';
            const retryAt = isRateError ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null;
            
            const { error: updateError } = await supabase
              .from('campaign_posts')
              .update({
                status: newStatus,
                error_message: errorMessage,
                error_code: isRateError ? 'RATE_LIMITED' : 'PUBLISH_FAILED',
                next_retry_at: retryAt
              })
              .eq('id', post.id);

            if (updateError) {
              console.error(`Error updating campaign post status to ${newStatus}:`, updateError);
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
        }

      } catch (error: any) {
        console.error(`Error publishing campaign post ${post.id}:`, error);
        
        // Check if it's a rate limit error using expanded patterns
        const isRateLimitError = isRateLimitErrorMessage(error.message || '');
        
        if (isRateLimitError) {
          // Set rate_limited with retry instead of failed
          const retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
          await supabase
            .from('campaign_posts')
            .update({
              status: 'rate_limited',
              error_message: error.message || 'Limit platformy - automatyczna ponowna próba.',
              error_code: 'RATE_LIMITED',
              next_retry_at: retryAt
            })
            .eq('id', post.id);
        } else {
          // Mark post as failed only for non-rate-limit errors
          // But first check if post is already rate_limited (don't overwrite!)
          const { data: currentPost } = await supabase
            .from('campaign_posts')
            .select('status')
            .eq('id', post.id)
            .single();
          
          if (currentPost?.status !== 'rate_limited') {
            await supabase
              .from('campaign_posts')
              .update({
                status: 'failed',
                error_message: error.message || 'Wystąpił nieoczekiwany błąd podczas publikacji.',
                error_code: 'UNEXPECTED_ERROR'
              })
              .eq('id', post.id);
          }
          
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
