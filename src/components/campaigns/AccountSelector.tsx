import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { PlatformId, getPlatformConfig } from "@/config/platforms";
import { Users, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AccountOption {
  id: string;
  display_name: string;
  is_default: boolean;
}

interface AccountSelectorProps {
  selectedPlatforms: PlatformId[];
  selectedAccounts: Record<PlatformId, string[]>;
  onChange: (accounts: Record<PlatformId, string[]>) => void;
}

export const AccountSelector = ({ selectedPlatforms, selectedAccounts, onChange }: AccountSelectorProps) => {
  const [accounts, setAccounts] = useState<Record<PlatformId, AccountOption[]>>({} as Record<PlatformId, AccountOption[]>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  // Auto-select default accounts when platforms change, and remove accounts for deselected platforms
  useEffect(() => {
    if (loading) return;
    
    const newSelectedAccounts: Record<string, string[]> = {};
    let changed = false;
    
    // Only keep accounts for selected platforms
    selectedPlatforms.forEach(platform => {
      const platformAccounts = accounts[platform] || [];
      const currentSelection = selectedAccounts[platform];
      
      if (platformAccounts.length > 0) {
        if (currentSelection && currentSelection.length > 0) {
          // Keep existing selection for this platform
          newSelectedAccounts[platform] = currentSelection;
        } else {
          // Auto-select default account or first account
          const defaultAccount = platformAccounts.find(a => a.is_default);
          newSelectedAccounts[platform] = [defaultAccount?.id || platformAccounts[0].id];
          changed = true;
        }
      }
    });
    
    // Check if any platforms were removed (accounts exist for platforms not in selectedPlatforms)
    Object.keys(selectedAccounts).forEach(platform => {
      if (!selectedPlatforms.includes(platform as PlatformId)) {
        changed = true; // Platform was deselected, will be removed
      }
    });
    
    if (changed || Object.keys(newSelectedAccounts).length !== Object.keys(selectedAccounts).length) {
      onChange(newSelectedAccounts as Record<PlatformId, string[]>);
    }
  }, [selectedPlatforms, accounts, loading]);

  const loadAccounts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const [xResult, fbResult, igResult, tiktokResult, ytResult, linkedinResult, telegramResult, blueskyResult, mastodonResult, pinterestResult, discordResult, tumblrResult, googleBizResult] = await Promise.all([
      supabase.from('twitter_oauth1_tokens').select('id, screen_name, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('facebook_oauth_tokens').select('id, page_name, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('instagram_oauth_tokens').select('id, instagram_username, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('tiktok_oauth_tokens').select('id, open_id, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('youtube_oauth_tokens').select('id, channel_title, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('linkedin_oauth_tokens').select('id, display_name, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('telegram_tokens').select('id, channel_name, chat_id, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('bluesky_tokens').select('id, handle, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('mastodon_tokens').select('id, username, server_url, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('pinterest_oauth_tokens').select('id, username, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('discord_tokens').select('id, channel_name, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('tumblr_oauth_tokens').select('id, blog_name, username, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('google_business_tokens').select('id, business_name, account_name, is_default').eq('user_id', session.user.id),
    ]);

    const newAccounts: Record<string, AccountOption[]> = {
      x: (xResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.screen_name ? `@${a.screen_name}` : (a.account_name || 'Konto X'),
        is_default: a.is_default ?? false,
      })),
      facebook: (fbResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.page_name || a.account_name || 'Strona Facebook',
        is_default: a.is_default ?? false,
      })),
      instagram: (igResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.instagram_username ? `@${a.instagram_username}` : (a.account_name || 'Konto Instagram'),
        is_default: a.is_default ?? false,
      })),
      tiktok: (tiktokResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.account_name || a.open_id?.substring(0, 8) || 'Konto TikTok',
        is_default: a.is_default ?? false,
      })),
      youtube: (ytResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.channel_title || a.account_name || 'Kanał YouTube',
        is_default: a.is_default ?? false,
      })),
      linkedin: (linkedinResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.display_name || a.account_name || 'Profil LinkedIn',
        is_default: a.is_default ?? false,
      })),
      telegram: (telegramResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.channel_name || a.account_name || `Chat ${a.chat_id}`,
        is_default: a.is_default ?? false,
      })),
      bluesky: (blueskyResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.handle ? `@${a.handle}` : (a.account_name || 'Konto Bluesky'),
        is_default: a.is_default ?? false,
      })),
      mastodon: (mastodonResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.username ? `@${a.username}@${a.server_url?.replace('https://', '')}` : (a.account_name || 'Konto Mastodon'),
        is_default: a.is_default ?? false,
      })),
      pinterest: (pinterestResult.data || []).map((a: any) => ({
        id: a.id,
        display_name: a.username ? `@${a.username}` : (a.account_name || 'Konto Pinterest'),
        is_default: a.is_default ?? false,
      })),
      discord: (discordResult.data || []).map((a: any) => ({
        id: a.id, display_name: a.channel_name || (a.account_name || 'Kanał Discord'), is_default: a.is_default ?? false,
      })),
      tumblr: (tumblrResult.data || []).map((a: any) => ({
        id: a.id, display_name: a.blog_name || a.username || (a.account_name || 'Blog Tumblr'), is_default: a.is_default ?? false,
      })),
      google_business: (googleBizResult.data || []).map((a: any) => ({
        id: a.id, display_name: a.business_name || (a.account_name || 'Firma Google'), is_default: a.is_default ?? false,
      })),
    };

    setAccounts(newAccounts as Record<PlatformId, AccountOption[]>);
    setLoading(false);
  };

  const handleAccountToggle = (platform: PlatformId, accountId: string, checked: boolean) => {
    const currentSelection = selectedAccounts[platform] || [];
    let newSelection: string[];
    
    if (checked) {
      // Add account
      newSelection = [...currentSelection, accountId];
    } else {
      // Remove account (but ensure at least one remains)
      if (currentSelection.length <= 1) {
        return; // Don't allow deselecting the last account
      }
      newSelection = currentSelection.filter(id => id !== accountId);
    }
    
    onChange({
      ...selectedAccounts,
      [platform]: newSelection,
    });
  };

  // Filter to only show platforms that have accounts
  const platformsWithAccounts = selectedPlatforms.filter(
    platform => (accounts[platform]?.length || 0) > 0
  );

  // Check for platforms with no selected accounts
  const platformsWithNoSelection = platformsWithAccounts.filter(
    platform => !selectedAccounts[platform] || selectedAccounts[platform].length === 0
  );

  if (loading) {
    return null;
  }

  // Show message if there are selected platforms with no accounts connected
  const platformsWithNoAccounts = selectedPlatforms.filter(
    platform => !accounts[platform] || accounts[platform].length === 0
  );

  if (platformsWithAccounts.length === 0 && platformsWithNoAccounts.length > 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Wybór kont do publikacji</h3>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Wybrane platformy ({platformsWithNoAccounts.map(p => getPlatformConfig(p)?.name || p).join(', ')}) nie mają połączonych kont.
            <br />
            <a href="/settings/social-accounts" className="underline font-medium">
              Połącz konta w ustawieniach
            </a>
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  if (platformsWithAccounts.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Wybór kont do publikacji</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Wybierz konta, na których mają być publikowane posty. Możesz zaznaczyć wiele kont.
      </p>

      <div className="space-y-6">
        {platformsWithAccounts.map(platform => {
          const platformConfig = getPlatformConfig(platform);
          const platformAccounts = accounts[platform] || [];
          const Icon = platformConfig?.icon;
          const currentSelection = selectedAccounts[platform] || [];

          return (
            <div key={platform} className="space-y-3">
              <div className="flex items-center gap-2">
                {Icon && (
                  <div className={`p-1.5 rounded bg-gradient-to-br ${platformConfig?.gradientFrom} ${platformConfig?.gradientTo}`}>
                    <Icon className={`h-4 w-4 ${platformConfig?.color}`} />
                  </div>
                )}
                <Label className="font-medium">{platformConfig?.name || platform}</Label>
                <Badge variant="secondary" className="text-xs">
                  {currentSelection.length} z {platformAccounts.length}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-8">
                {platformAccounts.map(account => {
                  const isChecked = currentSelection.includes(account.id);
                  const isLastSelected = currentSelection.length === 1 && isChecked;
                  
                  return (
                    <div 
                      key={account.id} 
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                        isChecked ? 'bg-primary/5 border-primary/30' : 'bg-background border-border hover:border-primary/20'
                      }`}
                    >
                      <Checkbox
                        id={`account-${platform}-${account.id}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => handleAccountToggle(platform, account.id, checked === true)}
                        disabled={isLastSelected}
                      />
                      <Label
                        htmlFor={`account-${platform}-${account.id}`}
                        className={`flex items-center gap-2 cursor-pointer flex-1 ${isLastSelected ? 'opacity-60' : ''}`}
                      >
                        <span className="text-sm">{account.display_name}</span>
                        {account.is_default && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                            Domyślne
                          </Badge>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {platformsWithNoSelection.length > 0 && (
        <Alert className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Wybierz co najmniej jedno konto dla każdej platformy: {platformsWithNoSelection.map(p => getPlatformConfig(p)?.name || p).join(', ')}
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
};
