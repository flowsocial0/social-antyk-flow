import { PlatformId } from './platforms';

export type MediaType = 'text' | 'image' | 'video' | 'text+image' | 'text+video' | 'image+video' | 'all';

export interface PlatformLimits {
  id: PlatformId;
  textLimit: number; // Maximum characters for post text
  mediaRequired: boolean; // Whether media is required for posts
  supportedMedia: MediaType; // Types of media supported
  videoMaxDuration?: number; // Maximum video duration in seconds
  videoMaxSize?: number; // Maximum video size in MB
  imageMaxSize?: number; // Maximum image size in MB
  maxImages?: number; // Maximum number of images per post
  maxVideos?: number; // Maximum number of videos per post
  hashtagLimit?: number; // Maximum number of hashtags
  authType: 'oauth1' | 'oauth2' | 'api-key' | 'not-implemented'; // Authentication method
  apiDocumentation: string; // Link to API documentation
}

export const platformLimits: Record<PlatformId, PlatformLimits> = {
  x: {
    id: 'x',
    textLimit: 280, // 4000 for Premium users
    mediaRequired: false,
    supportedMedia: 'all',
    videoMaxDuration: 140, // 2 minutes 20 seconds
    videoMaxSize: 512,
    imageMaxSize: 5,
    maxImages: 4,
    maxVideos: 1,
    hashtagLimit: 2, // Recommended, not enforced
    authType: 'oauth2',
    apiDocumentation: 'https://developer.x.com/en/docs/twitter-api',
  },
  facebook: {
    id: 'facebook',
    textLimit: 63206, // Practical limit
    mediaRequired: false,
    supportedMedia: 'all',
    videoMaxDuration: 240 * 60, // 240 minutes
    videoMaxSize: 10240, // 10GB
    imageMaxSize: 4,
    maxImages: 100,
    maxVideos: 1,
    authType: 'oauth2',
    apiDocumentation: 'https://developers.facebook.com/docs/graph-api',
  },
  instagram: {
    id: 'instagram',
    textLimit: 2200,
    mediaRequired: true, // Instagram requires at least one image or video
    supportedMedia: 'image+video',
    videoMaxDuration: 60, // 60 seconds for feed posts
    videoMaxSize: 100,
    imageMaxSize: 8,
    maxImages: 10, // Carousel posts
    maxVideos: 1,
    hashtagLimit: 30,
    authType: 'oauth2',
    apiDocumentation: 'https://developers.facebook.com/docs/instagram-api',
  },
  youtube: {
    id: 'youtube',
    textLimit: 5000, // Community posts
    mediaRequired: false, // Community posts don't require video
    supportedMedia: 'all',
    videoMaxDuration: 12 * 60 * 60, // 12 hours (verified accounts: unlimited)
    videoMaxSize: 256000, // 256GB
    imageMaxSize: 32,
    maxImages: 1,
    maxVideos: 1,
    authType: 'oauth2',
    apiDocumentation: 'https://developers.google.com/youtube/v3',
  },
  linkedin: {
    id: 'linkedin',
    textLimit: 3000,
    mediaRequired: false,
    supportedMedia: 'all',
    videoMaxDuration: 10 * 60, // 10 minutes
    videoMaxSize: 5120, // 5GB
    imageMaxSize: 8,
    maxImages: 9,
    maxVideos: 1,
    hashtagLimit: 3, // Recommended
    authType: 'oauth2',
    apiDocumentation: 'https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/share-api',
  },
  tiktok: {
    id: 'tiktok',
    textLimit: 2200, // Caption limit
    mediaRequired: true, // TikTok requires video
    supportedMedia: 'video',
    videoMaxDuration: 10 * 60, // 10 minutes
    videoMaxSize: 4096, // 4GB
    maxVideos: 1,
    hashtagLimit: 10, // Recommended
    authType: 'oauth2',
    apiDocumentation: 'https://developers.tiktok.com/doc/content-posting-api-get-started',
  },
  pinterest: {
    id: 'pinterest',
    textLimit: 500,
    mediaRequired: true, // Pinterest requires image
    supportedMedia: 'image+video',
    videoMaxDuration: 60 * 60, // 60 minutes
    videoMaxSize: 2048, // 2GB
    imageMaxSize: 32,
    maxImages: 1,
    maxVideos: 1,
    authType: 'oauth2',
    apiDocumentation: 'https://developers.pinterest.com/docs/api/v5/',
  },
  reddit: {
    id: 'reddit',
    textLimit: 40000,
    mediaRequired: false,
    supportedMedia: 'all',
    videoMaxDuration: 15 * 60, // 15 minutes
    videoMaxSize: 1024, // 1GB
    imageMaxSize: 20,
    maxImages: 20,
    maxVideos: 1,
    authType: 'oauth2',
    apiDocumentation: 'https://www.reddit.com/dev/api',
  },
  telegram: {
    id: 'telegram',
    textLimit: 4096,
    mediaRequired: false,
    supportedMedia: 'all',
    videoMaxDuration: undefined, // No specific limit
    videoMaxSize: 2048, // 2GB
    imageMaxSize: 10,
    maxImages: 10,
    maxVideos: 1,
    authType: 'api-key',
    apiDocumentation: 'https://core.telegram.org/bots/api',
  },
  threads: {
    id: 'threads',
    textLimit: 500,
    mediaRequired: false,
    supportedMedia: 'all',
    videoMaxDuration: 5 * 60, // 5 minutes
    videoMaxSize: 1024, // 1GB
    imageMaxSize: 8,
    maxImages: 10,
    maxVideos: 1,
    authType: 'oauth2',
    apiDocumentation: 'https://developers.facebook.com/docs/threads',
  },
  bluesky: {
    id: 'bluesky',
    textLimit: 300,
    mediaRequired: false,
    supportedMedia: 'all',
    videoMaxDuration: 60, // 1 minute
    videoMaxSize: 50,
    imageMaxSize: 1,
    maxImages: 4,
    maxVideos: 1,
    authType: 'api-key',
    apiDocumentation: 'https://docs.bsky.app/',
  },
  mastodon: {
    id: 'mastodon',
    textLimit: 500, // Default, can vary by instance
    mediaRequired: false,
    supportedMedia: 'all',
    videoMaxDuration: undefined, // Varies by instance
    videoMaxSize: 40, // Default, varies by instance
    imageMaxSize: 8, // Default, varies by instance
    maxImages: 4,
    maxVideos: 1,
    authType: 'oauth2',
    apiDocumentation: 'https://docs.joinmastodon.org/api/',
  },
  gab: {
    id: 'gab',
    textLimit: 3000,
    mediaRequired: false,
    supportedMedia: 'all',
    videoMaxDuration: undefined,
    videoMaxSize: 1024, // 1GB estimate
    imageMaxSize: 8,
    maxImages: 4,
    maxVideos: 1,
    authType: 'oauth2',
    apiDocumentation: 'https://developers.gab.com/',
  },
};

export const getPlatformLimits = (platformId: PlatformId): PlatformLimits => {
  return platformLimits[platformId];
};

export const validatePostLength = (platformId: PlatformId, text: string): boolean => {
  const limits = getPlatformLimits(platformId);
  return text.length <= limits.textLimit;
};

export const validateMedia = (
  platformId: PlatformId,
  hasImage: boolean,
  hasVideo: boolean
): { valid: boolean; message?: string } => {
  const limits = getPlatformLimits(platformId);
  
  if (limits.mediaRequired && !hasImage && !hasVideo) {
    return {
      valid: false,
      message: `${platformId} wymaga załączenia obrazu lub video`,
    };
  }
  
  if (hasVideo && limits.supportedMedia === 'image') {
    return {
      valid: false,
      message: `${platformId} nie wspiera video`,
    };
  }
  
  if (hasImage && limits.supportedMedia === 'video') {
    return {
      valid: false,
      message: `${platformId} wymaga video zamiast obrazu`,
    };
  }
  
  return { valid: true };
};

export const getTextLimitWarning = (platformId: PlatformId, currentLength: number): string | null => {
  const limits = getPlatformLimits(platformId);
  const remaining = limits.textLimit - currentLength;
  
  if (remaining < 0) {
    return `Przekroczono limit o ${Math.abs(remaining)} znaków`;
  }
  
  if (remaining < 50) {
    return `Pozostało ${remaining} znaków`;
  }
  
  return null;
};
