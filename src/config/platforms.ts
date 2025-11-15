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
  | 'reddit' 
  | 'telegram' 
  | 'threads' 
  | 'bluesky' 
  | 'mastodon' 
  | 'gab';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  icon: LucideIcon;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  path: string;
  status: 'active' | 'coming-soon' | 'planned';
  priority: number; // Lower number = higher priority in UI
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
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    gradientFrom: 'from-pink-500/20',
    gradientTo: 'to-purple-600/20',
    path: '/platforms/instagram',
    status: 'coming-soon',
    priority: 3,
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-500',
    gradientFrom: 'from-red-500/20',
    gradientTo: 'to-red-600/20',
    path: '/platforms/youtube',
    status: 'coming-soon',
    priority: 4,
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-700',
    gradientFrom: 'from-blue-700/20',
    gradientTo: 'to-blue-800/20',
    path: '/platforms/linkedin',
    status: 'coming-soon',
    priority: 5,
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: Video,
    color: 'text-slate-900',
    gradientFrom: 'from-slate-900/20',
    gradientTo: 'to-pink-500/20',
    path: '/platforms/tiktok',
    status: 'coming-soon',
    priority: 6,
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    icon: Image,
    color: 'text-red-600',
    gradientFrom: 'from-red-600/20',
    gradientTo: 'to-red-700/20',
    path: '/platforms/pinterest',
    status: 'planned',
    priority: 7,
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    icon: MessageCircle,
    color: 'text-orange-500',
    gradientFrom: 'from-orange-500/20',
    gradientTo: 'to-orange-600/20',
    path: '/platforms/reddit',
    status: 'planned',
    priority: 8,
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: 'text-sky-500',
    gradientFrom: 'from-sky-500/20',
    gradientTo: 'to-sky-600/20',
    path: '/platforms/telegram',
    status: 'planned',
    priority: 9,
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    icon: MessageCircle,
    color: 'text-slate-800',
    gradientFrom: 'from-slate-800/20',
    gradientTo: 'to-slate-900/20',
    path: '/platforms/threads',
    status: 'planned',
    priority: 10,
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    icon: Globe,
    color: 'text-sky-600',
    gradientFrom: 'from-sky-600/20',
    gradientTo: 'to-sky-700/20',
    path: '/platforms/bluesky',
    status: 'planned',
    priority: 11,
  },
  mastodon: {
    id: 'mastodon',
    name: 'Mastodon',
    icon: Globe,
    color: 'text-purple-600',
    gradientFrom: 'from-purple-600/20',
    gradientTo: 'to-purple-700/20',
    path: '/platforms/mastodon',
    status: 'planned',
    priority: 12,
  },
  gab: {
    id: 'gab',
    name: 'Gab',
    icon: MessageCircle,
    color: 'text-green-700',
    gradientFrom: 'from-green-700/20',
    gradientTo: 'to-green-800/20',
    path: '/platforms/gab',
    status: 'planned',
    priority: 13,
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
