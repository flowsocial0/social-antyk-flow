import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X as XIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { getPlatformConfig, PlatformId, platformConfigs } from "@/config/platforms";

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
  target_platforms?: string[];
};

interface AccountInfo {
  id: string;
  display_name: string;
  platform: string;
}

type ViewMode = "grid" | "list";
type SortKey = "name" | "status" | "start_date" | "duration_days" | "total_posts" | "published_posts" | "created_at";
type SortDir = "asc" | "desc";

interface ViewPrefs {
  view: ViewMode;
  platform: string; // 'all' or PlatformId
  status: string;   // 'all' or status
  sortKey: SortKey;
  sortDir: SortDir;
}

const PREFS_KEY = "campaigns:view-prefs";

const defaultPrefs: ViewPrefs = {
  view: "grid",
  platform: "all",
  status: "all",
  sortKey: "created_at",
  sortDir: "desc",
};

const loadPrefs = (): ViewPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    return defaultPrefs;
  }
};

const STATUS_OPTIONS = [
  { value: "all", label: "Wszystkie statusy" },
  { value: "draft", label: "Szkic" },
  { value: "scheduled", label: "Zaplanowana" },
  { value: "active", label: "Aktywna" },
  { value: "completed", label: "Zakończona" },
  { value: "cancelled", label: "Anulowana" },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft":
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Szkic</Badge>;
    case "scheduled":
      return <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" /> Zaplanowana</Badge>;
    case "active":
      return <Badge className="gap-1 bg-gradient-primary"><TrendingUp className="h-3 w-3" /> Aktywna</Badge>;
    case "completed":
      return <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3" /> Zakończona</Badge>;
    case "cancelled":
      return <Badge variant="secondary" className="gap-1 bg-red-500/10 text-red-600 border-red-500/20"><AlertCircle className="h-3 w-3" /> Anulowana</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getCampaignPlatforms = (c: Campaign): string[] => {
  const fromTarget = Array.isArray(c.target_platforms) ? c.target_platforms : [];
  const fromAccounts = c.selected_accounts ? Object.keys(c.selected_accounts) : [];
  return Array.from(new Set([...fromTarget, ...fromAccounts])).filter(Boolean);
};

export const CampaignsList = () => {
  const navigate = useNavigate();
  const [accountsMap, setAccountsMap] = useState<Record<string, AccountInfo>>({});
  const [prefs, setPrefs] = useState<ViewPrefs>(() => loadPrefs());
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  const updatePrefs = (patch: Partial<ViewPrefs>) =>
    setPrefs((p) => ({ ...p, ...patch }));

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data: campaignsData, error: campaignsError } = await (supabase as any)
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Single aggregated RPC call avoids the 1000-row default limit and N+1 queries
      const { data: countsData, error: countsError } = await (supabase as any)
        .rpc('get_campaign_post_counts');

      if (countsError) {
        console.error('Failed to fetch campaign post counts:', countsError);
      }

      const countsByCampaign: Record<string, Record<string, number>> = {};
      (countsData || []).forEach((row: any) => {
        if (!countsByCampaign[row.campaign_id]) countsByCampaign[row.campaign_id] = {};
        countsByCampaign[row.campaign_id][row.status] = Number(row.count) || 0;
      });

      const campaignsWithCounts = (campaignsData || []).map((campaign: any) => {
        const statusCounts = countsByCampaign[campaign.id] || {};
        const totalPosts = Object.values(statusCounts).reduce((a, b) => a + b, 0);
        return {
          ...campaign,
          total_posts: totalPosts,
          published_posts: statusCounts['published'] || 0,
          scheduled_posts: statusCounts['scheduled'] || 0,
        };
      });

      return campaignsWithCounts as Campaign[];
    },
  });

  // Load account info
  useEffect(() => {
    const loadAccountsInfo = async () => {
      if (!campaigns || campaigns.length === 0) return;

      const allAccountIds: Record<string, string[]> = {
        x: [], facebook: [], instagram: [], tiktok: [], youtube: [], linkedin: [],
      };

      campaigns.forEach((campaign) => {
        if (campaign.selected_accounts) {
          Object.entries(campaign.selected_accounts).forEach(([platform, ids]) => {
            if (allAccountIds[platform]) {
              allAccountIds[platform].push(...(ids as string[]));
            }
          });
        }
      });

      Object.keys(allAccountIds).forEach((key) => {
        allAccountIds[key] = [...new Set(allAccountIds[key])];
      });

      const newAccountsMap: Record<string, AccountInfo> = {};

      if (allAccountIds.x.length > 0) {
        const { data } = await supabase
          .from('twitter_oauth1_tokens')
          .select('id, screen_name, account_name')
          .in('id', allAccountIds.x);
        data?.forEach((a: any) => {
          newAccountsMap[a.id] = { id: a.id, display_name: a.screen_name ? `@${a.screen_name}` : (a.account_name || 'Konto X'), platform: 'x' };
        });
      }
      if (allAccountIds.facebook.length > 0) {
        const { data } = await (supabase as any).from('facebook_oauth_tokens').select('id, page_name, account_name').in('id', allAccountIds.facebook);
        data?.forEach((a: any) => { newAccountsMap[a.id] = { id: a.id, display_name: a.page_name || a.account_name || 'Strona Facebook', platform: 'facebook' }; });
      }
      if (allAccountIds.instagram.length > 0) {
        const { data } = await (supabase as any).from('instagram_oauth_tokens').select('id, instagram_username, account_name').in('id', allAccountIds.instagram);
        data?.forEach((a: any) => { newAccountsMap[a.id] = { id: a.id, display_name: a.instagram_username ? `@${a.instagram_username}` : (a.account_name || 'Konto Instagram'), platform: 'instagram' }; });
      }
      if (allAccountIds.tiktok.length > 0) {
        const { data } = await (supabase as any).from('tiktok_oauth_tokens').select('id, account_name, open_id').in('id', allAccountIds.tiktok);
        data?.forEach((a: any) => { newAccountsMap[a.id] = { id: a.id, display_name: a.account_name || a.open_id?.substring(0, 8) || 'Konto TikTok', platform: 'tiktok' }; });
      }
      if (allAccountIds.youtube.length > 0) {
        const { data } = await (supabase as any).from('youtube_oauth_tokens').select('id, channel_title, account_name').in('id', allAccountIds.youtube);
        data?.forEach((a: any) => { newAccountsMap[a.id] = { id: a.id, display_name: a.channel_title || a.account_name || 'Kanał YouTube', platform: 'youtube' }; });
      }
      if (allAccountIds.linkedin.length > 0) {
        const { data } = await (supabase as any).from('linkedin_oauth_tokens').select('id, display_name, account_name').in('id', allAccountIds.linkedin);
        data?.forEach((a: any) => { newAccountsMap[a.id] = { id: a.id, display_name: a.display_name || a.account_name || 'Profil LinkedIn', platform: 'linkedin' }; });
      }

      setAccountsMap(newAccountsMap);
    };

    loadAccountsInfo();
  }, [campaigns]);

  // Platform counts (chips)
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { all: campaigns?.length || 0 };
    campaigns?.forEach((c) => {
      getCampaignPlatforms(c).forEach((p) => {
        counts[p] = (counts[p] || 0) + 1;
      });
    });
    return counts;
  }, [campaigns]);

  // Filter + sort
  const filtered = useMemo(() => {
    if (!campaigns) return [];
    const q = search.trim().toLowerCase();
    let arr = campaigns.filter((c) => {
      if (prefs.status !== "all" && c.status !== prefs.status) return false;
      if (prefs.platform !== "all" && !getCampaignPlatforms(c).includes(prefs.platform)) return false;
      if (q) {
        const hay = `${c.name} ${c.description || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    arr = [...arr].sort((a, b) => {
      const k = prefs.sortKey;
      let av: any = (a as any)[k];
      let bv: any = (b as any)[k];
      if (k === "start_date" || k === "created_at") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else if (typeof av === "string") {
        av = av.toLowerCase();
        bv = (bv || "").toString().toLowerCase();
      } else {
        av = av ?? 0;
        bv = bv ?? 0;
      }
      if (av < bv) return prefs.sortDir === "asc" ? -1 : 1;
      if (av > bv) return prefs.sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [campaigns, search, prefs.status, prefs.platform, prefs.sortKey, prefs.sortDir]);

  const toggleSort = (key: SortKey) => {
    if (prefs.sortKey === key) {
      updatePrefs({ sortDir: prefs.sortDir === "asc" ? "desc" : "asc" });
    } else {
      updatePrefs({ sortKey: key, sortDir: "asc" });
    }
  };

  const SortHeader = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {prefs.sortKey === k ? (
          prefs.sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </TableHead>
  );

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

  // Platform chips (only those present in campaigns)
  const platformIds = (Object.keys(platformConfigs) as PlatformId[])
    .filter((id) => (platformCounts[id] || 0) > 0);

  const hasActiveFilters =
    search.trim() !== "" || prefs.status !== "all" || prefs.platform !== "all";

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj kampanii..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={prefs.status} onValueChange={(v) => updatePrefs({ status: v })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={`${prefs.sortKey}:${prefs.sortDir}`}
              onValueChange={(v) => {
                const [sortKey, sortDir] = v.split(":") as [SortKey, SortDir];
                updatePrefs({ sortKey, sortDir });
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at:desc">Najnowsze</SelectItem>
                <SelectItem value="created_at:asc">Najstarsze</SelectItem>
                <SelectItem value="name:asc">Tytuł A–Z</SelectItem>
                <SelectItem value="name:desc">Tytuł Z–A</SelectItem>
                <SelectItem value="start_date:desc">Data startu (najnowsze)</SelectItem>
                <SelectItem value="start_date:asc">Data startu (najstarsze)</SelectItem>
                <SelectItem value="total_posts:desc">Liczba postów (najwięcej)</SelectItem>
                <SelectItem value="published_posts:desc">Opublikowane (najwięcej)</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border rounded-md overflow-hidden">
              <Button
                type="button"
                size="sm"
                variant={prefs.view === "grid" ? "default" : "ghost"}
                onClick={() => updatePrefs({ view: "grid" })}
                className="rounded-none gap-1"
              >
                <LayoutGrid className="h-4 w-4" /> Karty
              </Button>
              <Button
                type="button"
                size="sm"
                variant={prefs.view === "list" ? "default" : "ghost"}
                onClick={() => updatePrefs({ view: "list" })}
                className="rounded-none gap-1"
              >
                <List className="h-4 w-4" /> Lista
              </Button>
            </div>
          </div>
        </div>

        {/* Platform folder chips */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={prefs.platform === "all" ? "default" : "outline"}
            onClick={() => updatePrefs({ platform: "all" })}
            className="gap-2 h-8"
          >
            Wszystkie
            <Badge variant="secondary" className="ml-1">{platformCounts.all || 0}</Badge>
          </Button>
          {platformIds.map((id) => {
            const cfg = platformConfigs[id];
            const Icon = cfg.icon;
            const active = prefs.platform === id;
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => updatePrefs({ platform: id })}
                className="gap-2 h-8"
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.name}
                <Badge variant="secondary" className="ml-1">{platformCounts[id] || 0}</Badge>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Empty result */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Brak kampanii pasujących do filtrów</p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                updatePrefs({ status: "all", platform: "all" });
              }}
              className="gap-2"
            >
              <XIcon className="h-4 w-4" /> Wyczyść filtry
            </Button>
          )}
        </div>
      ) : prefs.view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((campaign) => (
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
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader k="name" label="Tytuł" />
                <SortHeader k="status" label="Status" />
                <TableHead className="hidden md:table-cell">Platformy</TableHead>
                <SortHeader k="start_date" label="Data startu" className="hidden md:table-cell" />
                <SortHeader k="duration_days" label="Dni" className="hidden lg:table-cell" />
                <SortHeader k="published_posts" label="Opublikowane" />
                <SortHeader k="total_posts" label="Łącznie" />
                <TableHead className="hidden lg:table-cell w-[120px]">Postęp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const platforms = getCampaignPlatforms(c);
                const progress = c.total_posts ? ((c.published_posts || 0) / c.total_posts) * 100 : 0;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/campaigns/${c.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{c.name}</span>
                        {c.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">{c.description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {platforms.slice(0, 5).map((p) => {
                          const cfg = platformConfigs[p as PlatformId];
                          if (!cfg) return null;
                          const Icon = cfg.icon;
                          return (
                            <span
                              key={p}
                              title={cfg.name}
                              className="inline-flex items-center justify-center w-6 h-6 rounded bg-muted"
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                          );
                        })}
                        {platforms.length > 5 && (
                          <Badge variant="outline" className="text-xs">+{platforms.length - 5}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {format(new Date(c.start_date), "d MMM yyyy", { locale: pl })}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{c.duration_days}</TableCell>
                    <TableCell className="text-sm">{c.published_posts || 0}</TableCell>
                    <TableCell className="text-sm">{c.total_posts || 0}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};
