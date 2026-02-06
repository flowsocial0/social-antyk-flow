import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserSettings {
  id?: string;
  user_id?: string;
  ai_suffix_x: string;
  ai_suffix_facebook: string;
  ai_suffix_instagram: string;
  ai_suffix_linkedin: string;
  ai_suffix_tiktok: string;
  ai_suffix_youtube: string;
  default_hashtags_x: string;
  default_hashtags_facebook: string;
  default_hashtags_instagram: string;
  default_hashtags_linkedin: string;
  default_hashtags_tiktok: string;
  default_hashtags_youtube: string;
  default_website_url: string;
}

const defaultSettings: UserSettings = {
  ai_suffix_x: '(ai)',
  ai_suffix_facebook: '',
  ai_suffix_instagram: '',
  ai_suffix_linkedin: '',
  ai_suffix_tiktok: '',
  ai_suffix_youtube: '',
  default_hashtags_x: '',
  default_hashtags_facebook: '',
  default_hashtags_instagram: '',
  default_hashtags_linkedin: '',
  default_hashtags_tiktok: '',
  default_hashtags_youtube: '',
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

      const { data, error } = await (supabase as any)
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user settings:', error);
      }

      // Fetch admin defaults for fallback
      const { data: adminSettings, error: adminError } = await (supabase as any)
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'default_user_settings')
        .maybeSingle();

      if (adminError) {
        console.error('Error fetching admin settings:', adminError);
      }

      const admin = adminSettings?.setting_value || {};

      if (data) {
        // User has settings - use them, fallback to admin for missing fields
        setSettings({
          id: data.id,
          user_id: data.user_id,
          ai_suffix_x: data.ai_suffix_x ?? admin.ai_suffix_x ?? '(ai)',
          ai_suffix_facebook: data.ai_suffix_facebook ?? admin.ai_suffix_facebook ?? '',
          ai_suffix_instagram: data.ai_suffix_instagram ?? admin.ai_suffix_instagram ?? '',
          ai_suffix_linkedin: data.ai_suffix_linkedin ?? admin.ai_suffix_linkedin ?? '',
          ai_suffix_tiktok: data.ai_suffix_tiktok ?? admin.ai_suffix_tiktok ?? '',
          ai_suffix_youtube: data.ai_suffix_youtube ?? admin.ai_suffix_youtube ?? '',
          default_hashtags_x: data.default_hashtags_x ?? admin.default_hashtags_x ?? '',
          default_hashtags_facebook: data.default_hashtags_facebook ?? admin.default_hashtags_facebook ?? '',
          default_hashtags_instagram: data.default_hashtags_instagram ?? admin.default_hashtags_instagram ?? '',
          default_hashtags_linkedin: data.default_hashtags_linkedin ?? admin.default_hashtags_linkedin ?? '',
          default_hashtags_tiktok: data.default_hashtags_tiktok ?? admin.default_hashtags_tiktok ?? '',
          default_hashtags_youtube: data.default_hashtags_youtube ?? admin.default_hashtags_youtube ?? '',
          default_website_url: data.default_website_url ?? admin.default_website_url ?? '',
        });
      } else {
        // No user settings - use admin defaults
        setSettings({
          ai_suffix_x: admin.ai_suffix_x ?? '(ai)',
          ai_suffix_facebook: admin.ai_suffix_facebook ?? '',
          ai_suffix_instagram: admin.ai_suffix_instagram ?? '',
          ai_suffix_linkedin: admin.ai_suffix_linkedin ?? '',
          ai_suffix_tiktok: admin.ai_suffix_tiktok ?? '',
          ai_suffix_youtube: admin.ai_suffix_youtube ?? '',
          default_hashtags_x: admin.default_hashtags_x ?? '',
          default_hashtags_facebook: admin.default_hashtags_facebook ?? '',
          default_hashtags_instagram: admin.default_hashtags_instagram ?? '',
          default_hashtags_linkedin: admin.default_hashtags_linkedin ?? '',
          default_hashtags_tiktok: admin.default_hashtags_tiktok ?? '',
          default_hashtags_youtube: admin.default_hashtags_youtube ?? '',
          default_website_url: admin.default_website_url ?? '',
        });
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
        ai_suffix_linkedin: newSettings.ai_suffix_linkedin ?? settings.ai_suffix_linkedin,
        ai_suffix_tiktok: newSettings.ai_suffix_tiktok ?? settings.ai_suffix_tiktok,
        ai_suffix_youtube: newSettings.ai_suffix_youtube ?? settings.ai_suffix_youtube,
        default_hashtags_x: newSettings.default_hashtags_x ?? settings.default_hashtags_x,
        default_hashtags_facebook: newSettings.default_hashtags_facebook ?? settings.default_hashtags_facebook,
        default_hashtags_instagram: newSettings.default_hashtags_instagram ?? settings.default_hashtags_instagram,
        default_hashtags_linkedin: newSettings.default_hashtags_linkedin ?? settings.default_hashtags_linkedin,
        default_hashtags_tiktok: newSettings.default_hashtags_tiktok ?? settings.default_hashtags_tiktok,
        default_hashtags_youtube: newSettings.default_hashtags_youtube ?? settings.default_hashtags_youtube,
        default_website_url: newSettings.default_website_url ?? settings.default_website_url,
        user_id: user.id,
      };

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
        ai_suffix_linkedin: data.ai_suffix_linkedin || '',
        ai_suffix_tiktok: data.ai_suffix_tiktok || '',
        ai_suffix_youtube: data.ai_suffix_youtube || '',
        default_hashtags_x: data.default_hashtags_x || '',
        default_hashtags_facebook: data.default_hashtags_facebook || '',
        default_hashtags_instagram: data.default_hashtags_instagram || '',
        default_hashtags_linkedin: data.default_hashtags_linkedin || '',
        default_hashtags_tiktok: data.default_hashtags_tiktok || '',
        default_hashtags_youtube: data.default_hashtags_youtube || '',
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
