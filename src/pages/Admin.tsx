import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, Shield, Users, BookOpen, Calendar, Link2 } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { User } from "@supabase/supabase-js";

interface AdminStats {
  totalUsers: number;
  totalBooks: number;
  totalCampaigns: number;
  connectedAccounts: {
    x: number;
    facebook: number;
    instagram: number;
    youtube: number;
    tiktok: number;
  };
}

interface UserData {
  id: string;
  email: string;
  created_at: string;
  books_count: number;
  campaigns_count: number;
  connected_platforms: string[];
}

const Admin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();
  
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Redirect if not admin
  useEffect(() => {
    if (!roleLoading && !isAdmin && !authLoading) {
      navigate("/dashboard");
    }
  }, [roleLoading, isAdmin, authLoading, navigate]);

  // Fetch admin data
  useEffect(() => {
    const fetchAdminData = async () => {
      if (!isAdmin) return;
      
      setDataLoading(true);
      try {
        // Fetch aggregate stats
        const [booksRes, campaignsRes, xRes, fbRes, igRes, ytRes, ttRes] = await Promise.all([
          supabase.from('books').select('id', { count: 'exact', head: true }),
          supabase.from('campaigns').select('id', { count: 'exact', head: true }),
          supabase.from('twitter_oauth1_tokens').select('id', { count: 'exact', head: true }),
          supabase.from('facebook_oauth_tokens').select('id', { count: 'exact', head: true }),
          supabase.from('instagram_oauth_tokens').select('id', { count: 'exact', head: true }),
          supabase.from('youtube_oauth_tokens').select('id', { count: 'exact', head: true }),
          supabase.from('tiktok_oauth_tokens').select('id', { count: 'exact', head: true }),
        ]);

        // Get unique user IDs from books and campaigns
        const { data: bookUsers } = await supabase.from('books').select('user_id');
        const { data: campaignUsers } = await supabase.from('campaigns').select('user_id');
        
        const uniqueUserIds = new Set<string>();
        bookUsers?.forEach(b => uniqueUserIds.add(b.user_id));
        campaignUsers?.forEach(c => uniqueUserIds.add(c.user_id));

        setStats({
          totalUsers: uniqueUserIds.size,
          totalBooks: booksRes.count || 0,
          totalCampaigns: campaignsRes.count || 0,
          connectedAccounts: {
            x: xRes.count || 0,
            facebook: fbRes.count || 0,
            instagram: igRes.count || 0,
            youtube: ytRes.count || 0,
            tiktok: ttRes.count || 0,
          },
        });

        // Build user data
        const userDataMap = new Map<string, UserData>();
        
        // Initialize from unique users
        for (const userId of uniqueUserIds) {
          userDataMap.set(userId, {
            id: userId,
            email: userId.substring(0, 8) + '...',
            created_at: '',
            books_count: 0,
            campaigns_count: 0,
            connected_platforms: [],
          });
        }

        // Count books per user
        const { data: booksPerUser } = await supabase
          .from('books')
          .select('user_id');
        
        booksPerUser?.forEach(b => {
          const userData = userDataMap.get(b.user_id);
          if (userData) {
            userData.books_count++;
          }
        });

        // Count campaigns per user
        const { data: campaignsPerUser } = await supabase
          .from('campaigns')
          .select('user_id');
        
        campaignsPerUser?.forEach(c => {
          const userData = userDataMap.get(c.user_id);
          if (userData) {
            userData.campaigns_count++;
          }
        });

        // Get connected platforms per user
        const [xTokens, fbTokens, igTokens, ytTokens, ttTokens] = await Promise.all([
          supabase.from('twitter_oauth1_tokens').select('user_id'),
          supabase.from('facebook_oauth_tokens').select('user_id'),
          supabase.from('instagram_oauth_tokens').select('user_id'),
          supabase.from('youtube_oauth_tokens').select('user_id'),
          supabase.from('tiktok_oauth_tokens').select('user_id'),
        ]);

        xTokens.data?.forEach(t => {
          const userData = userDataMap.get(t.user_id);
          if (userData && !userData.connected_platforms.includes('X')) {
            userData.connected_platforms.push('X');
          }
        });

        fbTokens.data?.forEach(t => {
          const userData = userDataMap.get(t.user_id!);
          if (userData && !userData.connected_platforms.includes('Facebook')) {
            userData.connected_platforms.push('Facebook');
          }
        });

        igTokens.data?.forEach(t => {
          const userData = userDataMap.get(t.user_id);
          if (userData && !userData.connected_platforms.includes('Instagram')) {
            userData.connected_platforms.push('Instagram');
          }
        });

        ytTokens.data?.forEach(t => {
          const userData = userDataMap.get(t.user_id);
          if (userData && !userData.connected_platforms.includes('YouTube')) {
            userData.connected_platforms.push('YouTube');
          }
        });

        ttTokens.data?.forEach(t => {
          const userData = userDataMap.get(t.user_id);
          if (userData && !userData.connected_platforms.includes('TikTok')) {
            userData.connected_platforms.push('TikTok');
          }
        });

        setUsers(Array.from(userDataMap.values()));
      } catch (err) {
        console.error('Error fetching admin data:', err);
      } finally {
        setDataLoading(false);
      }
    };

    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-gradient-to-r from-red-600 to-red-800 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">Panel Administracyjny</h1>
                <p className="text-sm text-white/80">Zarządzanie systemem</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        {dataLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Książki</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalBooks || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Kampanie</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalCampaigns || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Połączone konta</CardTitle>
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(stats?.connectedAccounts.x || 0) + 
                     (stats?.connectedAccounts.facebook || 0) + 
                     (stats?.connectedAccounts.instagram || 0) + 
                     (stats?.connectedAccounts.youtube || 0) + 
                     (stats?.connectedAccounts.tiktok || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    X: {stats?.connectedAccounts.x || 0} | 
                    FB: {stats?.connectedAccounts.facebook || 0} | 
                    IG: {stats?.connectedAccounts.instagram || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Users Table */}
            <Card>
              <CardHeader>
                <CardTitle>Użytkownicy</CardTitle>
                <CardDescription>Lista wszystkich użytkowników systemu</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID użytkownika</TableHead>
                      <TableHead>Książki</TableHead>
                      <TableHead>Kampanie</TableHead>
                      <TableHead>Połączone platformy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userData) => (
                      <TableRow key={userData.id}>
                        <TableCell className="font-mono text-xs">
                          {userData.id.substring(0, 16)}...
                        </TableCell>
                        <TableCell>{userData.books_count}</TableCell>
                        <TableCell>{userData.campaigns_count}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {userData.connected_platforms.length > 0 ? (
                              userData.connected_platforms.map((platform) => (
                                <Badge key={platform} variant="secondary" className="text-xs">
                                  {platform}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">Brak</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Brak użytkowników
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Admin;
