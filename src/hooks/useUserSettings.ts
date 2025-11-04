import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/custom-client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserSettings {
  // Notifications
  push_notifications: boolean;
  email_notifications: boolean;
  in_app_notifications: boolean;
  notification_types: {
    new_view: boolean;
    new_user: boolean;
    weekly_report: boolean;
  };
  
  // Appearance
  theme: 'light' | 'dark' | 'system';
  color_scheme: string;
  font_size: 'small' | 'medium' | 'large';
  layout_mode: 'compact' | 'extended';
  
  // Language and Region
  language: 'en' | 'es' | 'fr' | 'de';
  date_format: string;
  time_format: '12h' | '24h';
  timezone: string;
  currency: string;
  
  // Privacy and Security
  profile_visibility: 'public' | 'private' | 'friends';
  data_sharing: boolean;
  two_factor_enabled: boolean;
  
  // Mobile Settings
  image_quality: 'low' | 'medium' | 'high';
  data_usage: 'low' | 'auto' | 'high';
  auto_downloads: boolean;
  local_storage_limit_mb: number;
  
  // Sync Settings
  cloud_sync: boolean;
  backup_frequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  sync_data_types: {
    tours: boolean;
    media: boolean;
    settings: boolean;
  };
  cross_device_sync: boolean;
  
  // Audio and Video
  default_volume: number;
  video_quality: 'low' | 'medium' | 'high' | 'auto';
  autoplay: boolean;
  sound_effects: boolean;
  
  // Analytics
  share_usage_data: boolean;
  auto_reports: boolean;
  metrics_to_track: {
    views: boolean;
    engagement: boolean;
    performance: boolean;
  };
  report_frequency: 'daily' | 'weekly' | 'monthly';
  
  // Account
  contact_preferences: {
    email: boolean;
    phone: boolean;
    sms: boolean;
  };
  subscription_tier: string;
  
  // PWA Update Settings
  pwa_auto_update: boolean;
  pwa_auto_update_delay: number;
  pwa_browser_notifications: boolean;
  pwa_check_interval: number;
}

const defaultSettings: UserSettings = {
  push_notifications: true,
  email_notifications: true,
  in_app_notifications: true,
  notification_types: { new_view: true, new_user: true, weekly_report: true },
  theme: 'system',
  color_scheme: 'default',
  font_size: 'medium',
  layout_mode: 'extended',
  language: 'en',
  date_format: 'MM/DD/YYYY',
  time_format: '12h',
  timezone: 'UTC',
  currency: 'USD',
  profile_visibility: 'private',
  data_sharing: false,
  two_factor_enabled: false,
  image_quality: 'high',
  data_usage: 'auto',
  auto_downloads: true,
  local_storage_limit_mb: 500,
  cloud_sync: true,
  backup_frequency: 'daily',
  sync_data_types: { tours: true, media: true, settings: true },
  cross_device_sync: true,
  default_volume: 80,
  video_quality: 'high',
  autoplay: false,
  sound_effects: true,
  share_usage_data: false,
  auto_reports: true,
  metrics_to_track: { views: true, engagement: true, performance: true },
  report_frequency: 'weekly',
  contact_preferences: { email: true, phone: false, sms: false },
  subscription_tier: 'free',
  pwa_auto_update: true,
  pwa_auto_update_delay: 0,
  pwa_browser_notifications: false,
  pwa_check_interval: 900000
};

const STORAGE_KEY = 'user_settings_cache';

export const useUserSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  // Auto-sync settings when connection returns
  useEffect(() => {
    const handleOnline = async () => {
      const cachedSettings = localStorage.getItem(STORAGE_KEY);
      if (cachedSettings && user) {
        try {
          const parsedSettings = JSON.parse(cachedSettings);
          await supabase
            .from('user_settings')
            .upsert({
              user_id: user.id,
              ...parsedSettings
            }, {
              onConflict: 'user_id'
            });
          toast.success('🌐 Settings synced to cloud');
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

  const loadSettings = async () => {
    // 1. Load from localStorage FIRST (instant, works offline)
    const cachedSettings = localStorage.getItem(STORAGE_KEY);
    if (cachedSettings) {
      try {
        const parsed = JSON.parse(cachedSettings);
        setSettings(parsed);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing cached settings:', error);
      }
    }

    // 2. Then try Supabase (if online and authenticated)
    if (!user || !navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const mergedSettings = {
          push_notifications: data.push_notifications,
          email_notifications: data.email_notifications,
          in_app_notifications: data.in_app_notifications,
          notification_types: data.notification_types as any,
          theme: data.theme as any,
          color_scheme: data.color_scheme,
          font_size: data.font_size as any,
          layout_mode: data.layout_mode as any,
          language: data.language as any,
          date_format: data.date_format,
          time_format: data.time_format as any,
          timezone: data.timezone,
          currency: data.currency,
          profile_visibility: data.profile_visibility as any,
          data_sharing: data.data_sharing,
          two_factor_enabled: data.two_factor_enabled,
          image_quality: data.image_quality as any,
          data_usage: data.data_usage as any,
          auto_downloads: data.auto_downloads,
          local_storage_limit_mb: data.local_storage_limit_mb,
          cloud_sync: data.cloud_sync,
          backup_frequency: data.backup_frequency as any,
          sync_data_types: data.sync_data_types as any,
          cross_device_sync: data.cross_device_sync,
          default_volume: data.default_volume,
          video_quality: data.video_quality as any,
          autoplay: data.autoplay,
          sound_effects: data.sound_effects,
          share_usage_data: data.share_usage_data,
          auto_reports: data.auto_reports,
          metrics_to_track: data.metrics_to_track as any,
          report_frequency: data.report_frequency as any,
          contact_preferences: data.contact_preferences as any,
          subscription_tier: data.subscription_tier,
          pwa_auto_update: data.pwa_auto_update ?? defaultSettings.pwa_auto_update,
          pwa_auto_update_delay: data.pwa_auto_update_delay ?? defaultSettings.pwa_auto_update_delay,
          pwa_browser_notifications: data.pwa_browser_notifications ?? defaultSettings.pwa_browser_notifications,
          pwa_check_interval: data.pwa_check_interval ?? defaultSettings.pwa_check_interval
        };
        setSettings(mergedSettings);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSettings));
      }
    } catch (error) {
      console.log('📴 Using cached settings (offline or error)');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    try {
      setSaving(true);
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);

      // ALWAYS save to localStorage (works offline)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));

      // Try Supabase only if online
      if (navigator.onLine && user) {
        try {
          const { error } = await supabase
            .from('user_settings')
            .upsert({
              user_id: user.id,
              ...newSettings
            }, {
              onConflict: 'user_id'
            });

          if (error) throw error;
          toast.success('Settings saved and synced');
        } catch (error) {
          console.error('Supabase save failed:', error);
          toast.success('Settings saved locally (will sync when online)');
        }
      } else {
        toast.success('Settings saved locally');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    loading,
    saving,
    updateSettings
  };
};
