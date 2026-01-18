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

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

interface UserData {
  id: string;
  email: string;
  created_at: string;
  books_count: number;
  campaigns_count: number;
  connected_platforms: {
    x: number;
    facebook: number;
    instagram: number;
    youtube: number;
    tiktok: number;
  };
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
        // Fetch all users from edge function
        const { data: authUsersResponse, error: authError } = await supabase.functions.invoke('admin-list-users');
        
        if (authError) {
          console.error('Error fetching users from edge function:', authError);
          throw authError;
        }

        const authUsers: AuthUser[] = authUsersResponse?.users || [];
        console.log(`Fetched ${authUsers.length} users from auth`);

        // Fetch aggregate stats and all data in parallel
        const [
          booksRes, 
          campaignsRes, 
          allBooks,
          allCampaigns,
          xTokens,
          fbTokens,
          igTokens,
          ytTokens,
          ttTokens
        ] = await Promise.all([
          supabase.from('books').select('id', { count: 'exact', head: true }),
          supabase.from('campaigns').select('id', { count: 'exact', head: true }),
          supabase.from('books').select('user_id'),
          supabase.from('campaigns').select('user_id'),
          supabase.from('twitter_oauth1_tokens').select('user_id'),
          supabase.from('facebook_oauth_tokens').select('user_id'),
          supabase.from('instagram_oauth_tokens').select('user_id'),
          supabase.from('youtube_oauth_tokens').select('user_id'),
          supabase.from('tiktok_oauth_tokens').select('user_id'),
        ]);

        // Calculate total connected accounts
        const totalConnected = {
          x: xTokens.data?.length || 0,
          facebook: fbTokens.data?.length || 0,
          instagram: igTokens.data?.length || 0,
          youtube: ytTokens.data?.length || 0,
          tiktok: ttTokens.data?.length || 0,
        };

        setStats({
          totalUsers: authUsers.length,
          totalBooks: booksRes.count || 0,
          totalCampaigns: campaignsRes.count || 0,
          connectedAccounts: totalConnected,
        });

        // Build user data map from auth users
        const userDataMap = new Map<string, UserData>();
        
        for (const authUser of authUsers) {
          userDataMap.set(authUser.id, {
            id: authUser.id,
            email: authUser.email,
            created_at: authUser.created_at,
            books_count: 0,
            campaigns_count: 0,
            connected_platforms: {
              x: 0,
              facebook: 0,
              instagram: 0,
              youtube: 0,
              tiktok: 0,
            },
          });
        }

        // Count books per user
        allBooks.data?.forEach(b => {
          const userData = userDataMap.get(b.user_id);
          if (userData) {
            userData.books_count++;
          }
        });

        // Count campaigns per user
        allCampaigns.data?.forEach(c => {
          const userData = userDataMap.get(c.user_id);
          if (userData) {
            userData.campaigns_count++;
          }
        });

        // Count connected platforms per user
        xTokens.data?.forEach(t => {
          const userData = userDataMap.get(t.user_id);
          if (userData) {
            userData.connected_platforms.x++;
          }
        });

        fbTokens.data?.forEach(t => {
          if (t.user_id) {
            const userData = userDataMap.get(t.user_id);
            if (userData) {
              userData.connected_platforms.facebook++;
            }
          }
        });

        igTokens.data?.forEach(t => {
          const userData = userDataMap.get(t.user_id);
          if (userData) {
            userData.connected_platforms.instagram++;
          }
        });

        ytTokens.data?.forEach(t => {
          const userData = userDataMap.get(t.user_id);
          if (userData) {
            userData.connected_platforms.youtube++;
          }
        });

        ttTokens.data?.forEach(t => {
          const userData = userDataMap.get(t.user_id);
          if (userData) {
            userData.connected_platforms.tiktok++;
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

  const getTotalPlatformCount = (platforms: UserData['connected_platforms']) => {
    return platforms.x + platforms.facebook + platforms.instagram + platforms.youtube + platforms.tiktok;
  };

  const formatPlatformBadges = (platforms: UserData['connected_platforms']) => {
    const badges: { label: string; count: number }[] = [];
    if (platforms.x > 0) badges.push({ label: 'X', count: platforms.x });
    if (platforms.facebook > 0) badges.push({ label: 'FB', count: platforms.facebook });
    if (platforms.instagram > 0) badges.push({ label: 'IG', count: platforms.instagram });
    if (platforms.youtube > 0) badges.push({ label: 'YT', count: platforms.youtube });
    if (platforms.tiktok > 0) badges.push({ label: 'TT', count: platforms.tiktok });
    return badges;
  };

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
                    IG: {stats?.connectedAccounts.instagram || 0} | 
                    YT: {stats?.connectedAccounts.youtube || 0} | 
                    TT: {stats?.connectedAccounts.tiktok || 0}
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
                      <TableHead>Email</TableHead>
                      <TableHead>Książki</TableHead>
                      <TableHead>Kampanie</TableHead>
                      <TableHead>Połączone konta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userData) => (
                      <TableRow key={userData.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{userData.email}</span>
                            <p className="text-xs text-muted-foreground font-mono">
                              {userData.id.substring(0, 8)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{userData.books_count}</TableCell>
                        <TableCell>{userData.campaigns_count}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap items-center">
                            {getTotalPlatformCount(userData.connected_platforms) > 0 ? (
                              <>
                                {formatPlatformBadges(userData.connected_platforms).map((badge) => (
                                  <Badge key={badge.label} variant="secondary" className="text-xs">
                                    {badge.label}: {badge.count}
                                  </Badge>
                                ))}
                              </>
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
