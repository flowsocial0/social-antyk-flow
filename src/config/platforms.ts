import { 
  Facebook, Instagram, Youtube, Linkedin, 
  Video, Image, MessageCircle, Send, Globe,
  LucideIcon
} from "lucide-react";

export type PlatformId = 
  | 'facebook' 
  | 'instagram' 
  | 'youtube' 
  | 'linkedin'
  | 'tiktok'
  | 'pinterest' 
  | 'reddit' 
  | 'telegram' 
  | 'threads' 
  | 'bluesky' 
  | 'mastodon' 
  | 'gab';

export type ContentType = 'text' | 'image' | 'video' | 'mixed';

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
  characterLimit: number;
  contentTypes: ContentType[];
  requiresAuth: boolean;
  supportsScheduling: boolean;
}

export const platformConfigs: Record<PlatformId, PlatformConfig> = {
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    gradientFrom: 'from-blue-600/20',
    gradientTo: 'to-blue-700/20',
    path: '/platforms/facebook',
    status: 'active',
    priority: 1,
    characterLimit: 63206,
    contentTypes: ['text', 'image', 'video', 'mixed'],
    requiresAuth: true,
    supportsScheduling: true,
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
    priority: 2,
    characterLimit: 2200,
    contentTypes: ['image', 'video', 'mixed'],
    requiresAuth: true,
    supportsScheduling: true,
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
    priority: 3,
    characterLimit: 5000,
    contentTypes: ['video'],
    requiresAuth: true,
    supportsScheduling: true,
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
    priority: 4,
    characterLimit: 3000,
    contentTypes: ['text', 'image', 'video', 'mixed'],
    requiresAuth: true,
    supportsScheduling: true,
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
    priority: 5,
    characterLimit: 2200,
    contentTypes: ['video'],
    requiresAuth: true,
    supportsScheduling: true,
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    icon: Image,
    color: 'text-red-600',
    gradientFrom: 'from-red-600/20',
    gradientTo: 'to-red-700/20',
    path: '/platforms/pinterest',
    status: 'coming-soon',
    priority: 6,
    characterLimit: 500,
    contentTypes: ['image'],
    requiresAuth: true,
    supportsScheduling: true,
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    icon: MessageCircle,
    color: 'text-orange-500',
    gradientFrom: 'from-orange-500/20',
    gradientTo: 'to-orange-600/20',
    path: '/platforms/reddit',
    status: 'coming-soon',
    priority: 7,
    characterLimit: 40000,
    contentTypes: ['text', 'image', 'video', 'mixed'],
    requiresAuth: true,
    supportsScheduling: true,
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: 'text-sky-500',
    gradientFrom: 'from-sky-500/20',
    gradientTo: 'to-sky-600/20',
    path: '/platforms/telegram',
    status: 'coming-soon',
    priority: 8,
    characterLimit: 4096,
    contentTypes: ['text', 'image', 'video', 'mixed'],
    requiresAuth: true,
    supportsScheduling: true,
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    icon: MessageCircle,
    color: 'text-slate-800',
    gradientFrom: 'from-slate-800/20',
    gradientTo: 'to-slate-900/20',
    path: '/platforms/threads',
    status: 'coming-soon',
    priority: 9,
    characterLimit: 500,
    contentTypes: ['text', 'image', 'mixed'],
    requiresAuth: true,
    supportsScheduling: true,
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    icon: Globe,
    color: 'text-sky-600',
    gradientFrom: 'from-sky-600/20',
    gradientTo: 'to-sky-700/20',
    path: '/platforms/bluesky',
    status: 'coming-soon',
    priority: 10,
    characterLimit: 300,
    contentTypes: ['text', 'image', 'mixed'],
    requiresAuth: true,
    supportsScheduling: true,
  },
  mastodon: {
    id: 'mastodon',
    name: 'Mastodon',
    icon: Globe,
    color: 'text-purple-600',
    gradientFrom: 'from-purple-600/20',
    gradientTo: 'to-purple-700/20',
    path: '/platforms/mastodon',
    status: 'coming-soon',
    priority: 11,
    characterLimit: 500,
    contentTypes: ['text', 'image', 'video', 'mixed'],
    requiresAuth: true,
    supportsScheduling: true,
  },
  gab: {
    id: 'gab',
    name: 'Gab',
    icon: MessageCircle,
    color: 'text-green-700',
    gradientFrom: 'from-green-700/20',
    gradientTo: 'to-green-800/20',
    path: '/platforms/gab',
    status: 'coming-soon',
    priority: 12,
    characterLimit: 3000,
    contentTypes: ['text', 'image', 'video', 'mixed'],
    requiresAuth: true,
    supportsScheduling: true,
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
