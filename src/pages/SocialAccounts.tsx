import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Twitter, Facebook, CheckCircle2, XCircle, Loader2, Video, ArrowLeft } from "lucide-react";

export default function SocialAccounts() {
  const navigate = useNavigate();
  const [isLoadingX, setIsLoadingX] = useState(false);
  const [isLoadingFB, setIsLoadingFB] = useState(false);
  const [isLoadingTikTok, setIsLoadingTikTok] = useState(false);
  const [xConnected, setXConnected] = useState(false);
  const [fbConnected, setFbConnected] = useState(false);
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [xUsername, setXUsername] = useState<string | null>(null);
  const [fbPageName, setFbPageName] = useState<string | null>(null);
  const [tiktokOpenId, setTiktokOpenId] = useState<string | null>(null);

  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Check X connection
    const { data: xData } = await supabase
      .from('twitter_oauth_tokens')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (xData) {
      setXConnected(true);
      // You could fetch username from X API here
    }

    // Check Facebook connection
    const { data: fbData } = await (supabase as any)
      .from('facebook_oauth_tokens')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fbData) {
      setFbConnected(true);
      setFbPageName((fbData as any).page_name ?? null);
    }

    // Check TikTok connection
    const { data: tiktokData } = await (supabase as any)
      .from('tiktok_oauth_tokens')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (tiktokData) {
      setTiktokConnected(true);
      setTiktokOpenId((tiktokData as any).open_id ?? null);
    }
  };

  const connectX = async () => {
    setIsLoadingX(true);
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany', {
          description: 'Zaloguj się, aby połączyć konto X'
        });
        setIsLoadingX(false);
        return;
      }

      const redirectUri = `${window.location.origin}/twitter-callback`;
      const { data, error } = await supabase.functions.invoke('twitter-oauth-start', {
        body: { redirectUri },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        // Store code verifier for callback
        if (data.codeVerifier) {
          sessionStorage.setItem('twitter_oauth_verifier', data.codeVerifier);
        }
        if (data.state) {
          sessionStorage.setItem('twitter_oauth_state', data.state);
        }
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      console.error('Error connecting X:', error);
      toast.error('Nie udało się połączyć z X', {
        description: error.message
      });
    } finally {
      setIsLoadingX(false);
    }
  };

  const connectFacebook = async () => {
    setIsLoadingFB(true);
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany', {
          description: 'Zaloguj się, aby połączyć konto Facebook'
        });
        setIsLoadingFB(false);
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
      console.error('Error connecting Facebook:', error);
      toast.error('Nie udało się połączyć z Facebook', {
        description: error.message
      });
    } finally {
      setIsLoadingFB(false);
    }
  };

  const disconnectX = async () => {
    try {
      const { error } = await supabase
        .from('twitter_oauth_tokens')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (error) throw error;
      
      setXConnected(false);
      setXUsername(null);
      toast.success('Odłączono konto X');
    } catch (error: any) {
      console.error('Error disconnecting X:', error);
      toast.error('Nie udało się odłączyć konta X');
    }
  };

  const disconnectFacebook = async () => {
    try {
      const { error } = await (supabase as any)
        .from('facebook_oauth_tokens')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (error) throw error;
      
      setFbConnected(false);
      setFbPageName(null);
      toast.success('Odłączono konto Facebook');
    } catch (error: any) {
      console.error('Error disconnecting Facebook:', error);
      toast.error('Nie udało się odłączyć konta Facebook');
    }
  };

  const connectTikTok = async () => {
    setIsLoadingTikTok(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany', {
          description: 'Zaloguj się, aby połączyć konto TikTok'
        });
        setIsLoadingTikTok(false);
        return;
      }

      const redirectUri = `${window.location.origin}/oauth/tiktok/callback`;
      const { data, error } = await supabase.functions.invoke('tiktok-oauth-start', {
        body: { redirectUri, userId: session.user.id }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        if (data.state) {
          sessionStorage.setItem('tiktok_oauth_state', data.state);
        }
        if (data.codeVerifier) {
          sessionStorage.setItem('tiktok_code_verifier', data.codeVerifier);
        }
        sessionStorage.setItem('tiktok_user_id', session.user.id);
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error connecting TikTok:', error);
      toast.error('Nie udało się połączyć z TikTok', {
        description: error.message
      });
    } finally {
      setIsLoadingTikTok(false);
    }
  };

  const disconnectTikTok = async () => {
    setIsLoadingTikTok(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Musisz być zalogowany');
        return;
      }

      // Call revoke function to properly disconnect from TikTok
      const { data, error } = await supabase.functions.invoke('tiktok-oauth-revoke', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setTiktokConnected(false);
        setTiktokOpenId(null);
        toast.success('Odłączono konto TikTok', {
          description: data.revokeResult
        });
      } else {
        throw new Error(data?.error || 'Nieznany błąd');
      }
    } catch (error: any) {
      console.error('Error disconnecting TikTok:', error);
      toast.error('Nie udało się odłączyć konta TikTok', {
        description: error.message
      });
    } finally {
      setIsLoadingTikTok(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
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
          Zarządzaj połączonymi kontami mediów społecznościowych
        </p>
      </div>

      <div className="space-y-4">
        {/* X / Twitter */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Twitter className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  X (Twitter)
                  {xConnected && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {xConnected 
                    ? `Połączono ${xUsername ? `jako @${xUsername}` : ''}`
                    : 'Nie połączono'
                  }
                </p>
              </div>
            </div>
            
            <div>
              {xConnected ? (
                <Button
                  variant="outline"
                  onClick={disconnectX}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Odłącz
                </Button>
              ) : (
                <Button
                  onClick={connectX}
                  disabled={isLoadingX}
                  className="gap-2"
                >
                  {isLoadingX ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Twitter className="h-4 w-4" />
                  )}
                  Połącz
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Facebook */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-600/10">
                <Facebook className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  Facebook
                  {fbConnected && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {fbConnected 
                    ? `Połączono${fbPageName ? ` - ${fbPageName}` : ''}`
                    : 'Nie połączono'
                  }
                </p>
              </div>
            </div>
            
            <div>
              {fbConnected ? (
                <Button
                  variant="outline"
                  onClick={disconnectFacebook}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Odłącz
                </Button>
              ) : (
                <Button
                  onClick={connectFacebook}
                  disabled={isLoadingFB}
                  className="gap-2"
                >
                  {isLoadingFB ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Facebook className="h-4 w-4" />
                  )}
                  Połącz
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* TikTok */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-slate-900/20 to-pink-500/20">
                <Video className="h-6 w-6 text-slate-900" />
              </div>
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  TikTok
                  {tiktokConnected && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tiktokConnected 
                    ? `Połączono${tiktokOpenId ? ` (${tiktokOpenId.substring(0, 8)}...)` : ''}`
                    : 'Nie połączono'
                  }
                </p>
              </div>
            </div>
            
            <div>
              {tiktokConnected ? (
                <Button
                  variant="outline"
                  onClick={disconnectTikTok}
                  disabled={isLoadingTikTok}
                  className="gap-2"
                >
                  {isLoadingTikTok ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Odłącz
                </Button>
              ) : (
                <Button
                  onClick={connectTikTok}
                  disabled={isLoadingTikTok}
                  className="gap-2"
                >
                  {isLoadingTikTok ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  Połącz
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 mt-6 bg-muted/30">
        <h3 className="font-semibold mb-2">Informacje</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Aby publikować posty, musisz najpierw połączyć odpowiednie konta</li>
          <li>• Tokeny dostępu są bezpiecznie przechowywane w bazie danych</li>
          <li>• Możesz odłączyć konto w dowolnym momencie</li>
          <li>• Facebook wymaga uprawnienia do zarządzania postami na stronie</li>
        </ul>
      </Card>
    </div>
  );
}
