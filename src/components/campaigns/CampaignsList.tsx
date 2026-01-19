import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, CheckCircle2, Clock, AlertCircle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { getPlatformConfig, PlatformId } from "@/config/platforms";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  duration_days: number;
  posts_per_day: number;
  content_posts_count: number;
  sales_posts_count: number;
  start_date: string;
  created_at: string;
  total_posts?: number;
  published_posts?: number;
  scheduled_posts?: number;
  selected_accounts?: Record<string, string[]>;
};

interface AccountInfo {
  id: string;
  display_name: string;
  platform: string;
}

export const CampaignsList = () => {
  const navigate = useNavigate();
  const [accountsMap, setAccountsMap] = useState<Record<string, AccountInfo>>({});

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data: campaignsData, error: campaignsError } = await (supabase as any)
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Fetch post counts for each campaign
      const campaignsWithCounts = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { data: posts } = await (supabase as any)
            .from('campaign_posts')
            .select('status')
            .eq('campaign_id', campaign.id);

          const totalPosts = posts?.length || 0;
          const publishedPosts = posts?.filter(p => p.status === 'published').length || 0;
          const scheduledPosts = posts?.filter(p => p.status === 'scheduled').length || 0;

          return {
            ...campaign,
            total_posts: totalPosts,
            published_posts: publishedPosts,
            scheduled_posts: scheduledPosts,
          };
        })
      );

      return campaignsWithCounts as Campaign[];
    },
  });

  // Load account info for all campaigns
  useEffect(() => {
    const loadAccountsInfo = async () => {
      if (!campaigns || campaigns.length === 0) return;

      // Collect all unique account IDs from all campaigns
      const allAccountIds: { x: string[]; facebook: string[]; instagram: string[]; tiktok: string[]; youtube: string[]; linkedin: string[] } = {
        x: [],
        facebook: [],
        instagram: [],
        tiktok: [],
        youtube: [],
        linkedin: [],
      };

      campaigns.forEach((campaign) => {
        if (campaign.selected_accounts) {
          Object.entries(campaign.selected_accounts).forEach(([platform, ids]) => {
            if (allAccountIds[platform as keyof typeof allAccountIds]) {
              allAccountIds[platform as keyof typeof allAccountIds].push(...(ids as string[]));
            }
          });
        }
      });

      // Deduplicate
      Object.keys(allAccountIds).forEach((key) => {
        allAccountIds[key as keyof typeof allAccountIds] = [...new Set(allAccountIds[key as keyof typeof allAccountIds])];
      });

      const newAccountsMap: Record<string, AccountInfo> = {};

      // Load X accounts
      if (allAccountIds.x.length > 0) {
        const { data } = await supabase
          .from('twitter_oauth1_tokens')
          .select('id, screen_name, account_name')
          .in('id', allAccountIds.x);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.screen_name ? `@${a.screen_name}` : (a.account_name || 'Konto X'),
            platform: 'x'
          };
        });
      }

      // Load Facebook accounts
      if (allAccountIds.facebook.length > 0) {
        const { data } = await (supabase as any)
          .from('facebook_oauth_tokens')
          .select('id, page_name, account_name')
          .in('id', allAccountIds.facebook);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.page_name || a.account_name || 'Strona Facebook',
            platform: 'facebook'
          };
        });
      }

      // Load Instagram accounts
      if (allAccountIds.instagram.length > 0) {
        const { data } = await (supabase as any)
          .from('instagram_oauth_tokens')
          .select('id, instagram_username, account_name')
          .in('id', allAccountIds.instagram);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.instagram_username ? `@${a.instagram_username}` : (a.account_name || 'Konto Instagram'),
            platform: 'instagram'
          };
        });
      }

      // Load TikTok accounts
      if (allAccountIds.tiktok.length > 0) {
        const { data } = await (supabase as any)
          .from('tiktok_oauth_tokens')
          .select('id, account_name, open_id')
          .in('id', allAccountIds.tiktok);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.account_name || a.open_id?.substring(0, 8) || 'Konto TikTok',
            platform: 'tiktok'
          };
        });
      }

      // Load YouTube accounts
      if (allAccountIds.youtube.length > 0) {
        const { data } = await (supabase as any)
          .from('youtube_oauth_tokens')
          .select('id, channel_title, account_name')
          .in('id', allAccountIds.youtube);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.channel_title || a.account_name || 'Kanał YouTube',
            platform: 'youtube'
          };
        });
      }

      // Load LinkedIn accounts
      if (allAccountIds.linkedin.length > 0) {
        const { data } = await (supabase as any)
          .from('linkedin_oauth_tokens')
          .select('id, display_name, account_name')
          .in('id', allAccountIds.linkedin);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = {
            id: a.id,
            display_name: a.display_name || a.account_name || 'Profil LinkedIn',
            platform: 'linkedin'
          };
        });
      }

      setAccountsMap(newAccountsMap);
    };

    loadAccountsInfo();
  }, [campaigns]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Szkic</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" /> Zaplanowana</Badge>;
      case 'active':
        return <Badge className="gap-1 bg-gradient-primary"><TrendingUp className="h-3 w-3" /> Aktywna</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3" /> Zakończona</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="gap-1 bg-red-500/10 text-red-600 border-red-500/20"><AlertCircle className="h-3 w-3" /> Anulowana</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Ładowanie kampanii...</p>
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Brak kampanii</h3>
        <p className="text-muted-foreground mb-6">
          Rozpocznij swoją pierwszą kampanię AI i zaplanuj posty na media społecznościowe
        </p>
        <Button onClick={() => navigate('/campaigns/new')} className="gap-2">
          <Calendar className="h-4 w-4" />
          Utwórz pierwszą kampanię
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => (
        <Card
          key={campaign.id}
          className="p-6 hover:shadow-glow transition-all duration-300 cursor-pointer"
          onClick={() => navigate(`/campaigns/${campaign.id}`)}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">{campaign.name}</h3>
            {getStatusBadge(campaign.status)}
          </div>

          {campaign.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {campaign.description}
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {format(new Date(campaign.start_date), "d MMMM yyyy", { locale: pl })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Łącznie:</span>
                <span className="ml-2 font-semibold">{campaign.total_posts || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Czas trwania:</span>
                <span className="ml-2 font-semibold">{campaign.duration_days} dni</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{campaign.published_posts || 0} opublikowanych</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span>{campaign.scheduled_posts || 0} zaplanowanych</span>
              </div>
            </div>

            {/* Selected accounts */}
            {campaign.selected_accounts && Object.keys(campaign.selected_accounts).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                {Object.entries(campaign.selected_accounts).map(([platform, accountIds]) => {
                  const platformConfig = getPlatformConfig(platform as PlatformId);
                  const Icon = platformConfig?.icon;
                  return (accountIds as string[]).slice(0, 3).map((accountId) => {
                    const accountInfo = accountsMap[accountId];
                    return (
                      <Badge key={accountId} variant="outline" className="gap-1 text-xs py-0.5 px-2">
                        {Icon && <Icon className="h-3 w-3" />}
                        <span className="truncate max-w-[100px]">
                          {accountInfo?.display_name || '...'}
                        </span>
                      </Badge>
                    );
                  });
                })}
                {Object.values(campaign.selected_accounts).flat().length > 3 && (
                  <Badge variant="outline" className="text-xs py-0.5 px-2">
                    +{Object.values(campaign.selected_accounts).flat().length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Progress bar */}
            <div className="pt-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-primary transition-all duration-300"
                  style={{
                    width: `${
                      campaign.total_posts
                        ? ((campaign.published_posts || 0) / campaign.total_posts) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
