import React, { createContext, useContext, useEffect } from 'react';
import { useUserSettings, UserSettings } from '@/hooks/useUserSettings';
import { useTheme } from '@/components/contexts/ThemeContext';
import i18n from '@/i18n/config';

interface UserSettingsContextType {
  settings: UserSettings;
  loading: boolean;
  saving: boolean;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export const useUserSettingsContext = () => {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettingsContext must be used within UserSettingsProvider');
  }
  return context;
};

export const UserSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const userSettings = useUserSettings();
  const { updateTheme } = useTheme();

  // Sync theme settings with ThemeContext
  useEffect(() => {
    if (!userSettings.loading && userSettings.settings) {
      const { theme, font_size, color_scheme } = userSettings.settings;
      
      // Map user_settings to ThemeContext format
      updateTheme({
        background_theme: color_scheme,
        font_size: font_size,
      });

      // Apply dark/light mode
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        // System theme
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
      }
    }
  }, [userSettings.settings.theme, userSettings.settings.font_size, userSettings.settings.color_scheme, userSettings.loading]);

  // Sync language with i18n
  useEffect(() => {
    if (!userSettings.loading && userSettings.settings.language) {
      if (i18n.language !== userSettings.settings.language) {
        i18n.changeLanguage(userSettings.settings.language);
      }
    }
  }, [userSettings.settings.language, userSettings.loading]);

  // Apply other settings globally
  useEffect(() => {
    if (!userSettings.loading) {
      const { default_volume, sound_effects, autoplay } = userSettings.settings;
      
      // Store in sessionStorage for components to access
      sessionStorage.setItem('app_volume', String(default_volume));
      sessionStorage.setItem('app_sound_effects', String(sound_effects));
      sessionStorage.setItem('app_autoplay', String(autoplay));
    }
  }, [
    userSettings.settings.default_volume,
    userSettings.settings.sound_effects,
    userSettings.settings.autoplay,
    userSettings.loading
  ]);

  return (
    <UserSettingsContext.Provider value={userSettings}>
      {children}
    </UserSettingsContext.Provider>
  );
};
