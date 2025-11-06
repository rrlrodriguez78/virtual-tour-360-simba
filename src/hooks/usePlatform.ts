import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Capacitor detection (will work when Capacitor is installed)
const getCapacitorPlatform = (): 'web' | 'android' | 'ios' => {
  // Check URL parameter first for development/preview
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const forcedPlatform = params.get('platform');
    if (forcedPlatform === 'android' || forcedPlatform === 'ios' || forcedPlatform === 'web') {
      return forcedPlatform as 'web' | 'android' | 'ios';
    }
  }
  
  // @ts-ignore - Capacitor may not be installed yet
  if (typeof window !== 'undefined' && window.Capacitor) {
    // @ts-ignore
    const platform = window.Capacitor.getPlatform();
    return platform as 'web' | 'android' | 'ios';
  }
  return 'web';
};

const isNativePlatform = (): boolean => {
  // @ts-ignore
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() || false;
};

interface PlatformInfo {
  platform: 'web' | 'android' | 'ios';
  isWeb: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isNative: boolean;
  isTouchDevice: boolean;
  screenSize: number;
  screenWidth: number;
  screenHeight: number;
  getComponentForPlatform: (baseName: string) => string;
}

export function usePlatform(): PlatformInfo {
  const [screenSize, setScreenSize] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 0
  );
  const [screenDimensions, setScreenDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const platform = getCapacitorPlatform();
  const isNative = isNativePlatform();
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  useEffect(() => {
    const handleResize = () => {
      setScreenSize(window.innerWidth);
      setScreenDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getComponentForPlatform = (baseName: string): string => {
    return `${baseName}_${platform}`;
  };

  return {
    platform,
    isWeb: platform === 'web',
    isAndroid: platform === 'android',
    isIOS: platform === 'ios',
    isNative,
    isTouchDevice,
    screenSize,
    screenWidth: screenDimensions.width,
    screenHeight: screenDimensions.height,
    getComponentForPlatform,
  };
}

// Hook to get platform-specific UI configuration from database
export function usePlatformConfig(pageName: string, forcePlatform?: 'web' | 'android' | 'ios') {
  const { platform } = usePlatform();
  const targetPlatform = forcePlatform || platform;

  return useQuery({
    queryKey: ['platform-config', pageName, targetPlatform],
    queryFn: async () => {
      // CRITICAL: Only query for the specific platform to ensure isolation
      const { data, error } = await supabase
        .from('platform_ui_config')
        .select('*')
        .eq('page_name', pageName)
        .eq('platform', targetPlatform) // Changed from .in() to .eq() for strict isolation
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to get platform-specific feature flags
export function usePlatformFeatures(pageName: string) {
  const { data: config } = usePlatformConfig(pageName);
  const { platform } = usePlatform();

  const features = (config?.feature_flags as Record<string, any>) || {};
  
  return {
    web: (features.web as Record<string, any>) || {},
    android: (features.android as Record<string, any>) || {},
    ios: (features.ios as Record<string, any>) || {},
    both: (features.both as Record<string, any>) || {},
    current: (features[platform] as Record<string, any>) || {},
  };
}

// Hook to get platform-specific layout configuration
export function usePlatformLayout(pageName: string) {
  const { data: config } = usePlatformConfig(pageName);
  const { platform } = usePlatform();

  const layout = (config?.layout_config as Record<string, any>) || {};
  
  return {
    web: (layout.web as Record<string, any>) || {},
    android: (layout.android as Record<string, any>) || {},
    ios: (layout.ios as Record<string, any>) || {},
    current: (layout[platform] as Record<string, any>) || {},
  };
}
