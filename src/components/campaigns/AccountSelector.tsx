import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { PlatformId, getPlatformConfig } from "@/config/platforms";
import { Users } from "lucide-react";

interface AccountOption {
  id: string;
  display_name: string;
  is_default: boolean;
}

interface AccountSelectorProps {
  selectedPlatforms: PlatformId[];
  selectedAccounts: Record<PlatformId, string>;
  onChange: (accounts: Record<PlatformId, string>) => void;
}

export const AccountSelector = ({ selectedPlatforms, selectedAccounts, onChange }: AccountSelectorProps) => {
  const [accounts, setAccounts] = useState<Record<PlatformId, AccountOption[]>>({} as Record<PlatformId, AccountOption[]>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const [xResult, fbResult, igResult, tiktokResult, ytResult] = await Promise.all([
      supabase.from('twitter_oauth1_tokens').select('id, screen_name, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('facebook_oauth_tokens').select('id, page_name, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('instagram_oauth_tokens').select('id, instagram_username, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('tiktok_oauth_tokens').select('id, open_id, account_name, is_default').eq('user_id', session.user.id),
      (supabase as any).from('youtube_oauth_tokens').select('id, channel_title, account_name, is_default').eq('user_id', session.user.id),
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
    };

    setAccounts(newAccounts as Record<PlatformId, AccountOption[]>);

    // Auto-select default accounts for selected platforms
    const autoSelected: Record<string, string> = { ...selectedAccounts };
    selectedPlatforms.forEach(platform => {
      if (!autoSelected[platform] && newAccounts[platform]?.length > 0) {
        const defaultAccount = newAccounts[platform].find(a => a.is_default);
        autoSelected[platform] = defaultAccount?.id || newAccounts[platform][0].id;
      }
    });
    onChange(autoSelected as Record<PlatformId, string>);

    setLoading(false);
  };

  const handleAccountChange = (platform: PlatformId, accountId: string) => {
    onChange({
      ...selectedAccounts,
      [platform]: accountId,
    });
  };

  // Filter to only show platforms that have multiple accounts
  const platformsWithMultipleAccounts = selectedPlatforms.filter(
    platform => (accounts[platform]?.length || 0) > 1
  );

  if (loading || platformsWithMultipleAccounts.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Wybór kont do publikacji</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Masz wiele kont połączonych z niektórymi platformami. Wybierz, które konta mają być użyte w tej kampanii.
      </p>

      <div className="space-y-4">
        {platformsWithMultipleAccounts.map(platform => {
          const platformConfig = getPlatformConfig(platform);
          const platformAccounts = accounts[platform] || [];
          const Icon = platformConfig?.icon;

          return (
            <div key={platform} className="flex items-center gap-4">
              <div className="flex items-center gap-2 min-w-[140px]">
                {Icon && <Icon className="h-4 w-4" />}
                <Label className="font-medium">{platformConfig?.name || platform}</Label>
              </div>
              
              <Select
                value={selectedAccounts[platform] || ''}
                onValueChange={(value) => handleAccountChange(platform, value)}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Wybierz konto" />
                </SelectTrigger>
                <SelectContent>
                  {platformAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <span>{account.display_name}</span>
                        {account.is_default && (
                          <Badge variant="secondary" className="text-xs">Domyślne</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
