import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Twitter, Facebook, Instagram, Youtube, CheckCircle2, Loader2, Video, ArrowLeft, Plus, Trash2, Linkedin, MessageCircle, Send, Globe } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { TelegramSetupDialog } from "@/components/social/TelegramSetupDialog";
import { BlueskySetupDialog } from "@/components/social/BlueskySetupDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SocialAccount {
  id: string;
  account_name: string | null;
  display_name: string;
}

interface PlatformAccounts {
  x: SocialAccount[];
  facebook: SocialAccount[];
  instagram: SocialAccount[];
  tiktok: SocialAccount[];
  youtube: SocialAccount[];
  linkedin: SocialAccount[];
  threads: SocialAccount[];
  telegram: SocialAccount[];
  bluesky: SocialAccount[];
}

export default function SocialAccounts() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [accounts, setAccounts] = useState<PlatformAccounts>({
    x: [],
    facebook: [],
    instagram: [],
    tiktok: [],
    youtube: [],
    linkedin: [],
    threads: [],
    telegram: [],
    bluesky: [],
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; platform: string; accountId: string; accountName: string }>({
    open: false,
    platform: '',
    accountId: '',
    accountName: '',
  });
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [blueskyDialogOpen, setBlueskyDialogOpen] = useState(false);

  useEffect(() => {
    loadAllAccounts();
    
    // Auto-refresh after OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true' || params.get('success') || params.get('instagram') === 'connected' || params.get('youtube') === 'connected') {
      loadAllAccounts();
      window.history.replaceState({}, '', '/settings/social-accounts');
    }
    // Handle errors
    if (params.get('youtube') === 'error' || params.get('instagram') === 'error') {
      const message = params.get('message');
      toast.error('Błąd połączenia', { description: message || 'Spróbuj ponownie' });
      window.history.replaceState({}, '', '/settings/social-accounts');
    }
  }, []);

  const loadAllAccounts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load all accounts for each platform
    const [xResult, fbResult, igResult, tiktokResult, ytResult, linkedinResult, threadsResult, telegramResult, blueskyResult] = await Promise.all([
      supabase.from('twitter_oauth1_tokens').select('*').eq('user_id', session.user.id),
      (supabase as any).from('facebook_oauth_tokens').select('*').eq('user_id', session.user.id),
      (supabase as any).from('instagram_oauth_tokens').select('*').eq('user_id', session.user.id),
      (supabase as any).from('tiktok_oauth_tokens').select('*').eq('user_id', session.user.id),
      (supabase as any).from('youtube_oauth_tokens').select('*').eq('user_id', session.user.id),
      (supabase as any).from('linkedin_oauth_tokens').select('*').eq('user_id', session.user.id),
      (supabase as any).from('threads_oauth_tokens').select('*').eq('user_id', session.user.id),
      (supabase as any).from('telegram_tokens').select('*').eq('user_id', session.user.id),
      (supabase as any).from('bluesky_tokens').select('*').eq('user_id', session.user.id),
    ]);

    setAccounts({
      x: (xResult.data || []).map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        display_name: a.screen_name ? `@${a.screen_name}` : 'Konto X',
      })),
      facebook: (fbResult.data || []).map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        display_name: a.page_name || 'Strona Facebook',
      })),
      instagram: (igResult.data || []).map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        display_name: a.instagram_username ? `@${a.instagram_username}` : 'Konto Instagram',
      })),
      tiktok: (tiktokResult.data || []).map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        display_name: a.account_name || a.open_id?.substring(0, 8) || 'Konto TikTok',
      })),
      youtube: (ytResult.data || []).map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        display_name: a.channel_title || 'Kanał YouTube',
      })),
      linkedin: (linkedinResult.data || []).map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        display_name: a.display_name || 'Profil LinkedIn',
      })),
      threads: (threadsResult.data || []).map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        display_name: a.username ? `@${a.username}` : 'Konto Threads',
      })),
      telegram: (telegramResult.data || []).map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        display_name: a.channel_name || a.chat_id || 'Kanał Telegram',
      })),
      bluesky: (blueskyResult.data || []).map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        display_name: a.handle || 'Konto Bluesky',
      })),
    });
  };

  const setLoading = (key: string, value: boolean) => {
    setIsLoading(prev => ({ ...prev, [key]: value }));
  };

  const connectX = async () => {
    setLoading('x', true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany');
        return;
      }

      const redirectUri = `${window.location.origin}/twitter-callback`;
      // Use OAuth 1.0a for X (required for public pictures)
      const { data, error } = await supabase.functions.invoke('twitter-oauth1-start', {
        body: { redirectUri },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        if (data.state) sessionStorage.setItem('twitter_oauth1_state', data.state);
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      toast.error('Nie udało się połączyć z X', { description: error.message });
    } finally {
      setLoading('x', false);
    }
  };

  const connectFacebook = async () => {
    setLoading('facebook', true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany');
        return;
      }

      const redirectUri = `${window.location.origin}/oauth/facebook/callback`;
      const { data, error } = await supabase.functions.invoke('facebook-oauth-start', {
        body: { redirectUri, userId: session.user.id }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        if (data.state) {
          sessionStorage.setItem('facebook_state', data.state);
          sessionStorage.setItem('facebook_user_id', session.user.id);
        }
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast.error('Nie udało się połączyć z Facebook', { description: error.message });
    } finally {
      setLoading('facebook', false);
    }
  };

  const connectInstagram = async () => {
    setLoading('instagram', true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany');
        return;
      }

      const { data, error } = await supabase.functions.invoke('instagram-oauth-start', {
        body: { userId: session.user.id }
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        if (data.state) sessionStorage.setItem('instagram_oauth_state', data.state);
        sessionStorage.setItem('instagram_user_id', session.user.id);
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      toast.error('Nie udało się połączyć z Instagram', { description: error.message });
    } finally {
      setLoading('instagram', false);
    }
  };

  const connectTikTok = async () => {
    setLoading('tiktok', true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany');
        return;
      }

      const redirectUri = `${window.location.origin}/oauth/tiktok/callback`;
      const { data, error } = await supabase.functions.invoke('tiktok-oauth-start', {
        body: { redirectUri, userId: session.user.id }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        if (data.state) sessionStorage.setItem('tiktok_oauth_state', data.state);
        if (data.codeVerifier) sessionStorage.setItem('tiktok_code_verifier', data.codeVerifier);
        sessionStorage.setItem('tiktok_user_id', session.user.id);
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast.error('Nie udało się połączyć z TikTok', { description: error.message });
    } finally {
      setLoading('tiktok', false);
    }
  };

  const connectYouTube = async () => {
    setLoading('youtube', true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany');
        return;
      }

      const redirectUri = `${window.location.origin}/oauth/youtube/callback`;
      const { data, error } = await supabase.functions.invoke('youtube-oauth-start', {
        body: { redirectUri }
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        if (data.state) sessionStorage.setItem('youtube_oauth_state', data.state);
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      toast.error('Nie udało się połączyć z YouTube', { description: error.message });
    } finally {
      setLoading('youtube', false);
    }
  };

  const connectLinkedIn = async () => {
    setLoading('linkedin', true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany');
        return;
      }

      const { data, error } = await supabase.functions.invoke('linkedin-oauth-start', {
        body: { userId: session.user.id }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        if (data.state) {
          sessionStorage.setItem('linkedin_state', data.state);
          sessionStorage.setItem('linkedin_user_id', session.user.id);
        }
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast.error('Nie udało się połączyć z LinkedIn', { description: error.message });
    } finally {
      setLoading('linkedin', false);
    }
  };

  const connectThreads = async () => {
    setLoading('threads', true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany');
        return;
      }

      const { data, error } = await supabase.functions.invoke('threads-oauth-start', {
        body: { userId: session.user.id }
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        if (data.state) sessionStorage.setItem('threads_oauth_state', data.state);
        sessionStorage.setItem('threads_user_id', session.user.id);
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      toast.error('Nie udało się połączyć z Threads', { description: error.message });
    } finally {
      setLoading('threads', false);
    }
  };

  const connectTelegram = async () => {
    setTelegramDialogOpen(true);
  };

  const connectBluesky = async () => {
    setBlueskyDialogOpen(true);
  };

  const deleteAccount = async (platform: string, accountId: string) => {
    setLoading(`delete-${accountId}`, true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const tableMap: Record<string, string> = {
        x: 'twitter_oauth1_tokens',
        facebook: 'facebook_oauth_tokens',
        instagram: 'instagram_oauth_tokens',
        tiktok: 'tiktok_oauth_tokens',
        youtube: 'youtube_oauth_tokens',
        linkedin: 'linkedin_oauth_tokens',
        threads: 'threads_oauth_tokens',
        telegram: 'telegram_tokens',
        bluesky: 'bluesky_tokens',
      };

      const { error } = await (supabase as any)
        .from(tableMap[platform])
        .delete()
        .eq('id', accountId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      toast.success('Konto zostało usunięte');
      loadAllAccounts();
    } catch (error: any) {
      toast.error('Nie udało się usunąć konta', { description: error.message });
    } finally {
      setLoading(`delete-${accountId}`, false);
      setDeleteDialog({ open: false, platform: '', accountId: '', accountName: '' });
    }
  };

  // Removed setAsDefault function - we no longer use default accounts
  // All connected accounts receive publications simultaneously

  const platformConfig = [
    { id: 'x', name: 'X (Twitter)', icon: Twitter, color: 'text-blue-500', bgColor: 'bg-blue-500/10', connect: connectX },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-600/10', connect: connectFacebook },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-500', bgColor: 'bg-pink-500/10', connect: connectInstagram },
    { id: 'tiktok', name: 'TikTok', icon: Video, color: 'text-black dark:text-white', bgColor: 'bg-black/10 dark:bg-white/10', connect: connectTikTok },
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-500', bgColor: 'bg-red-500/10', connect: connectYouTube },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-700/10', connect: connectLinkedIn },
    { id: 'threads', name: 'Threads', icon: MessageCircle, color: 'text-slate-800', bgColor: 'bg-slate-800/10', connect: connectThreads },
    { id: 'telegram', name: 'Telegram', icon: Send, color: 'text-sky-500', bgColor: 'bg-sky-500/10', connect: connectTelegram, formType: 'telegram' as const },
    { id: 'bluesky', name: 'Bluesky', icon: Globe, color: 'text-sky-600', bgColor: 'bg-sky-600/10', connect: connectBluesky, formType: 'bluesky' as const },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")} 
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Powrót do aplikacji
          </Button>
          <h1 className="text-3xl font-bold mb-2">Konta społecznościowe</h1>
          <p className="text-muted-foreground">
            Zarządzaj połączonymi kontami mediów społecznościowych. Możesz podłączyć wiele kont do każdej platformy.
          </p>
        </div>

        <div className="space-y-6">
          {platformConfig.map((platform) => {
            const Icon = platform.icon;
            const platformAccounts = accounts[platform.id as keyof PlatformAccounts];
            
            return (
              <Card key={platform.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${platform.bgColor}`}>
                      <Icon className={`h-6 w-6 ${platform.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {platform.name}
                        {platformAccounts.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {platformAccounts.length} {platformAccounts.length === 1 ? 'konto' : 'kont'}
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {platformAccounts.length === 0 
                          ? 'Brak połączonych kont'
                          : 'Kliknij "Dodaj kolejne" aby połączyć więcej kont'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={platform.connect}
                    disabled={isLoading[platform.id]}
                    variant={platformAccounts.length === 0 ? "default" : "outline"}
                    className="gap-2"
                  >
                    {isLoading[platform.id] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {platformAccounts.length === 0 ? 'Połącz' : 'Dodaj kolejne'}
                  </Button>
                </div>

                {platformAccounts.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    {platformAccounts.map((account) => (
                      <div 
                        key={account.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{account.display_name}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteDialog({
                              open: true,
                              platform: platform.id,
                              accountId: account.id,
                              accountName: account.display_name,
                            })}
                            disabled={isLoading[`delete-${account.id}`]}
                            className="text-destructive hover:text-destructive"
                          >
                            {isLoading[`delete-${account.id}`] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Wskazówki</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Możesz podłączyć wiele kont do każdej platformy</li>
            <li>• Publikacja z listy książek trafi na WSZYSTKIE połączone konta</li>
            <li>• W ustawieniach kampanii możesz wybrać konkretne konta do publikacji</li>
          </ul>
        </div>
      </div>

      <Footer />

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń konto</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz odłączyć konto <strong>{deleteDialog.accountName}</strong>? 
              Ta akcja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAccount(deleteDialog.platform, deleteDialog.accountId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TelegramSetupDialog
        open={telegramDialogOpen}
        onOpenChange={setTelegramDialogOpen}
        onSuccess={loadAllAccounts}
      />
      <BlueskySetupDialog
        open={blueskyDialogOpen}
        onOpenChange={setBlueskyDialogOpen}
        onSuccess={loadAllAccounts}
      />
    </div>
  );
}
