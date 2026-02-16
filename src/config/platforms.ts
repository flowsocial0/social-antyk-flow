import { 
  Twitter, Facebook, Instagram, Youtube, Linkedin, 
  Video, Image, MessageCircle, Send, Camera, 
  Users, Globe, Tv, DollarSign, Map, Shield,
  LucideIcon
} from "lucide-react";

export type PlatformId = 
  | 'x' 
  | 'facebook' 
  | 'instagram' 
  | 'youtube' 
  | 'tiktok'
  | 'linkedin' 
  | 'pinterest' 
   
  | 'telegram' 
  | 'threads' 
  | 'bluesky' 
  | 'mastodon' 
  | 'discord'
  | 'tumblr'
  | 'snapchat'
  | 'google_business';

export type MediaType = 'video-only' | 'image-only' | 'both';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  icon: LucideIcon;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  path: string;
  status: 'active' | 'coming-soon' | 'planned';
  priority: number;
  mediaType: MediaType;
  popular?: boolean;
  shortDescription?: string;
}

export const platformConfigs: Record<PlatformId, PlatformConfig> = {
  x: {
    id: 'x',
    name: 'X (Twitter)',
    icon: Twitter,
    color: 'text-blue-500',
    gradientFrom: 'from-blue-500/20',
    gradientTo: 'to-blue-600/20',
    path: '/platforms/x',
    status: 'active',
    priority: 1,
    mediaType: 'both',
    popular: true,
    shortDescription: 'Posty, obrazki i wideo. Idealne do szybkich ogłoszeń.',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    gradientFrom: 'from-blue-600/20',
    gradientTo: 'to-blue-700/20',
    path: '/platforms/facebook',
    status: 'active',
    priority: 2,
    mediaType: 'both',
    popular: true,
    shortDescription: 'Publikuj na stronie/profilu z obrazkami i wideo.',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    gradientFrom: 'from-pink-500/20',
    gradientTo: 'to-purple-600/20',
    path: '/platforms/instagram',
    status: 'active',
    priority: 3,
    mediaType: 'image-only',
    popular: true,
    shortDescription: 'Posty ze zdjęciami na feedzie Instagram.',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-500',
    gradientFrom: 'from-red-500/20',
    gradientTo: 'to-red-600/20',
    path: '/platforms/youtube',
    status: 'active',
    priority: 4,
    mediaType: 'video-only',
    popular: true,
    shortDescription: 'Wrzucaj filmy promocyjne na swój kanał.',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-700',
    gradientFrom: 'from-blue-700/20',
    gradientTo: 'to-blue-800/20',
    path: '/platforms/linkedin',
    status: 'active',
    priority: 5,
    mediaType: 'both',
    popular: true,
    shortDescription: 'Profesjonalne posty z obrazkami i wideo.',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: Video,
    color: 'text-slate-900',
    gradientFrom: 'from-slate-900/20',
    gradientTo: 'to-pink-500/20',
    path: '/platforms/tiktok',
    status: 'active',
    priority: 3,
    mediaType: 'video-only',
    popular: true,
    shortDescription: 'Publikuj krótkie filmy promocyjne.',
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    icon: Image,
    color: 'text-red-600',
    gradientFrom: 'from-red-600/20',
    gradientTo: 'to-red-700/20',
    path: '/platforms/pinterest',
    status: 'active',
    priority: 8,
    mediaType: 'image-only',
    shortDescription: 'Przypinaj obrazki jako piny z linkiem do produktu.',
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: 'text-sky-500',
    gradientFrom: 'from-sky-500/20',
    gradientTo: 'to-sky-600/20',
    path: '/platforms/telegram',
    status: 'active',
    priority: 7,
    mediaType: 'both',
    shortDescription: 'Wysyłaj wiadomości na kanał/grupę przez bota.',
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    icon: MessageCircle,
    color: 'text-slate-800',
    gradientFrom: 'from-slate-800/20',
    gradientTo: 'to-slate-900/20',
    path: '/platforms/threads',
    status: 'active',
    priority: 6,
    mediaType: 'both',
    shortDescription: 'Krótkie posty tekstowe z mediami.',
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    icon: Globe,
    color: 'text-sky-600',
    gradientFrom: 'from-sky-600/20',
    gradientTo: 'to-sky-700/20',
    path: '/platforms/bluesky',
    status: 'active',
    priority: 7,
    mediaType: 'image-only',
    shortDescription: 'Posty z obrazkami na zdecentralizowanej sieci.',
  },
  mastodon: {
    id: 'mastodon',
    name: 'Mastodon',
    icon: Globe,
    color: 'text-purple-600',
    gradientFrom: 'from-purple-600/20',
    gradientTo: 'to-purple-700/20',
    path: '/platforms/mastodon',
    status: 'active',
    priority: 10,
    mediaType: 'both',
    shortDescription: 'Tooty z mediami na wybranej instancji.',
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    icon: MessageCircle,
    color: 'text-indigo-500',
    gradientFrom: 'from-indigo-500/20',
    gradientTo: 'to-indigo-600/20',
    path: '/platforms/discord',
    status: 'active',
    priority: 12,
    mediaType: 'both',
    shortDescription: 'Wysyłaj posty na kanał przez webhook.',
  },
  tumblr: {
    id: 'tumblr',
    name: 'Tumblr',
    icon: Globe,
    color: 'text-blue-900',
    gradientFrom: 'from-blue-900/20',
    gradientTo: 'to-blue-950/20',
    path: '/platforms/tumblr',
    status: 'active',
    priority: 13,
    mediaType: 'both',
    shortDescription: 'Posty na blogu z obrazkami i wideo.',
  },
  snapchat: {
    id: 'snapchat',
    name: 'Snapchat',
    icon: Camera,
    color: 'text-yellow-500',
    gradientFrom: 'from-yellow-500/20',
    gradientTo: 'to-yellow-600/20',
    path: '/platforms/snapchat',
    status: 'active',
    priority: 14,
    mediaType: 'image-only',
    shortDescription: 'Publikuj obrazki jako Snap Stories.',
  },
  google_business: {
    id: 'google_business',
    name: 'Google Business',
    icon: Map,
    color: 'text-blue-500',
    gradientFrom: 'from-blue-500/20',
    gradientTo: 'to-green-500/20',
    path: '/platforms/google-business',
    status: 'active',
    priority: 15,
    mediaType: 'both',
    shortDescription: 'Posty w wizytówce Google Maps.',
  },
};

export const getPlatformConfig = (platformId: PlatformId): PlatformConfig => {
  return platformConfigs[platformId];
};

export const getAllPlatforms = (): PlatformConfig[] => {
  return Object.values(platformConfigs).sort((a, b) => a.priority - b.priority);
};

export const getActivePlatforms = (): PlatformConfig[] => {
  return getAllPlatforms().filter(p => p.status === 'active');
};

export const getComingSoonPlatforms = (): PlatformConfig[] => {
  return getAllPlatforms().filter(p => p.status === 'coming-soon');
};

export const getPlannedPlatforms = (): PlatformConfig[] => {
  return getAllPlatforms().filter(p => p.status === 'planned');
};

export const getVideoOnlyPlatforms = (): PlatformConfig[] => {
  return getAllPlatforms().filter(p => p.mediaType === 'video-only');
};

export const getImageOnlyPlatforms = (): PlatformConfig[] => {
  return getAllPlatforms().filter(p => p.mediaType === 'image-only');
};

export const platformRequiresVideo = (platformId: PlatformId): boolean => {
  return platformConfigs[platformId]?.mediaType === 'video-only';
};

export const platformSupportsVideo = (platformId: PlatformId): boolean => {
  const mediaType = platformConfigs[platformId]?.mediaType;
  return mediaType === 'video-only' || mediaType === 'both';
};

export const getPopularPlatforms = (): PlatformConfig[] => {
  return getAllPlatforms().filter(p => p.popular);
};

export const getOtherPlatforms = (): PlatformConfig[] => {
  return getAllPlatforms().filter(p => !p.popular);
};
