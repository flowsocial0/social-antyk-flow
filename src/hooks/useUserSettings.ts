import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserSettings {
  id?: string;
  user_id?: string;
  ai_suffix_x: string;
  ai_suffix_facebook: string;
  ai_suffix_instagram: string;
  ai_suffix_tiktok: string;
  ai_suffix_youtube: string;
  default_website_url: string;
}

const defaultSettings: UserSettings = {
  ai_suffix_x: '(ai)',
  ai_suffix_facebook: '',
  ai_suffix_instagram: '',
  ai_suffix_tiktok: '',
  ai_suffix_youtube: '',
  default_website_url: '',
};

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSettings(defaultSettings);
        setLoading(false);
        return;
      }

      // Use any to bypass type checking for new table
      const { data, error } = await (supabase as any)
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user settings:', error);
        setSettings(defaultSettings);
      } else if (data) {
        setSettings({
          id: data.id,
          user_id: data.user_id,
          ai_suffix_x: data.ai_suffix_x || '(ai)',
          ai_suffix_facebook: data.ai_suffix_facebook || '',
          ai_suffix_instagram: data.ai_suffix_instagram || '',
          ai_suffix_tiktok: data.ai_suffix_tiktok || '',
          ai_suffix_youtube: data.ai_suffix_youtube || '',
          default_website_url: data.default_website_url || '',
        });
      } else {
        // No settings found, use defaults
        setSettings(defaultSettings);
      }
    } catch (err) {
      console.error('Error in useUserSettings:', err);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSettings = async (newSettings: Partial<UserSettings>) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Musisz być zalogowany');
        return false;
      }

      const settingsToSave = {
        ai_suffix_x: newSettings.ai_suffix_x ?? settings.ai_suffix_x,
        ai_suffix_facebook: newSettings.ai_suffix_facebook ?? settings.ai_suffix_facebook,
        ai_suffix_instagram: newSettings.ai_suffix_instagram ?? settings.ai_suffix_instagram,
        ai_suffix_tiktok: newSettings.ai_suffix_tiktok ?? settings.ai_suffix_tiktok,
        ai_suffix_youtube: newSettings.ai_suffix_youtube ?? settings.ai_suffix_youtube,
        default_website_url: newSettings.default_website_url ?? settings.default_website_url,
        user_id: user.id,
      };

      // Use any to bypass type checking for new table
      const { data, error } = await (supabase as any)
        .from('user_settings')
        .upsert(settingsToSave, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving user settings:', error);
        toast.error('Nie udało się zapisać ustawień');
        return false;
      }

      setSettings({
        id: data.id,
        user_id: data.user_id,
        ai_suffix_x: data.ai_suffix_x || '(ai)',
        ai_suffix_facebook: data.ai_suffix_facebook || '',
        ai_suffix_instagram: data.ai_suffix_instagram || '',
        ai_suffix_tiktok: data.ai_suffix_tiktok || '',
        ai_suffix_youtube: data.ai_suffix_youtube || '',
        default_website_url: data.default_website_url || '',
      });
      
      toast.success('Ustawienia zapisane');
      return true;
    } catch (err) {
      console.error('Error in saveSettings:', err);
      toast.error('Wystąpił błąd podczas zapisywania');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { settings, loading, saving, saveSettings, refetch: fetchSettings };
};
