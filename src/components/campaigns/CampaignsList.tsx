import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

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
};

export const CampaignsList = () => {
  const navigate = useNavigate();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Fetch post counts for each campaign
      const campaignsWithCounts = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { data: posts } = await supabase
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
