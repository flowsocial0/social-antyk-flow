import { Badge } from "@/components/ui/badge";
import { Twitter, Facebook, CheckCircle2, XCircle, Clock } from "lucide-react";

interface PlatformBadgeProps {
  platform: 'x' | 'facebook';
  status?: 'published' | 'failed' | 'scheduled';
}

export const PlatformBadge = ({ platform, status }: PlatformBadgeProps) => {
  const getIcon = () => {
    if (platform === 'x') {
      return <Twitter className="h-3 w-3" />;
    }
    return <Facebook className="h-3 w-3" />;
  };

  const getStatusIcon = () => {
    if (!status) return null;
    
    switch (status) {
      case 'published':
        return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-600" />;
      case 'scheduled':
        return <Clock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getVariant = () => {
    if (!status) return "outline";
    
    switch (status) {
      case 'published':
        return "secondary" as const;
      case 'failed':
        return "destructive" as const;
      case 'scheduled':
        return "outline" as const;
      default:
        return "outline" as const;
    }
  };

  const getClassName = () => {
    if (!status) return "";
    
    switch (status) {
      case 'published':
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case 'failed':
        return "";
      case 'scheduled':
        return "";
      default:
        return "";
    }
  };

  return (
    <Badge variant={getVariant()} className={`gap-1 ${getClassName()}`}>
      {getIcon()}
      {platform === 'x' ? 'X' : 'FB'}
      {getStatusIcon()}
    </Badge>
  );
};
