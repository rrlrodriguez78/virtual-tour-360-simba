import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PlatformEditorContextType {
  isEditorOpen: boolean;
  openEditor: () => void;
  closeEditor: () => void;
  currentPlatform: 'web' | 'android' | 'both';
  setCurrentPlatform: (platform: 'web' | 'android' | 'both') => void;
  currentPageName: string;
  setCurrentPageName: (name: string) => void;
  tempLayoutConfig: any;
  setTempLayoutConfig: (config: any) => void;
  tempFeatureFlags: any;
  setTempFeatureFlags: (flags: any) => void;
  originalConfig: any;
  saveChanges: () => Promise<void>;
  revertChanges: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  loadPageConfig: (pageName: string, platform: 'web' | 'android') => Promise<void>;
}

const PlatformEditorContext = createContext<PlatformEditorContextType | undefined>(undefined);

const routeToPageNameMap: Record<string, string> = {
  '/app/inicio': 'Inicio',
  '/app/tours': 'Dashboard',
  '/app/tours-publicos': 'PublicTours',
  '/app/editor': 'Editor',
  '/app/photo-editor': 'PhotoEditor',
  '/app/viewer': 'Viewer',
  '/app/settings': 'Settings',
  '/app/user-settings': 'UserSettings',
  '/app/super-admin': 'SuperAdminDashboard',
  '/app/tenant-admin': 'TenantAdmin',
  '/app/tenant-members': 'TenantMembers',
  '/app/user-approvals': 'UserApprovals',
  '/app/backups': 'BackupsPage',
  '/app/platform-control': 'PlatformControlCenter',
  '/app/platform-ui-manager': 'PlatformUIManager',
};

export const PlatformEditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<'web' | 'android' | 'both'>('web');
  const [currentPageName, setCurrentPageName] = useState<string>('');
  const [tempLayoutConfig, setTempLayoutConfig] = useState<any>({});
  const [tempFeatureFlags, setTempFeatureFlags] = useState<any>({});
  const [originalConfig, setOriginalConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const location = useLocation();

  // Auto-detect current page from route
  useEffect(() => {
    const detectedPage = routeToPageNameMap[location.pathname] || 
                         location.pathname.split('/').pop() || 
                         'Unknown';
    setCurrentPageName(detectedPage);
  }, [location.pathname]);

  // Load config when page or platform changes
  useEffect(() => {
    if (isEditorOpen && currentPageName) {
      loadPageConfig(currentPageName, currentPlatform);
    }
  }, [currentPageName, currentPlatform, isEditorOpen]);

  const loadPageConfig = async (pageName: string, platform: 'web' | 'android' | 'both') => {
    try {
      if (platform === 'both') {
        // Load both configurations in parallel
        const [webResult, androidResult] = await Promise.all([
          supabase.from('platform_ui_config')
            .select('*')
            .eq('page_name', pageName)
            .eq('platform', 'web')
            .eq('is_active', true)
            .maybeSingle(),
          supabase.from('platform_ui_config')
            .select('*')
            .eq('page_name', pageName)
            .eq('platform', 'android')
            .eq('is_active', true)
            .maybeSingle()
        ]);

        const webConfig = webResult.data?.layout_config || {};
        const androidConfig = androidResult.data?.layout_config || {};
        
        // Use web config as base for both mode
        setTempLayoutConfig(webConfig);
        setOriginalConfig({ web: webResult.data, android: androidResult.data });
        setTempFeatureFlags(webResult.data?.feature_flags || {});
        return;
      }

      const { data, error } = await supabase
        .from('platform_ui_config')
        .select('*')
        .eq('page_name', pageName)
        .eq('platform', platform)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOriginalConfig(data);
        setTempLayoutConfig(data.layout_config || {});
        setTempFeatureFlags(data.feature_flags || {});
      } else {
        // No config exists, start with defaults
        setOriginalConfig(null);
        setTempLayoutConfig({
          columns: 3,
          gap: 4,
          padding: 4,
          cardSize: 'md',
          showSidebar: false,
          headerStyle: 'default',
          navigationStyle: 'default',
        });
        setTempFeatureFlags({});
      }
    } catch (error) {
      console.error('Error loading page config:', error);
      toast.error('Error al cargar configuración');
    }
  };

  const openEditor = () => setIsEditorOpen(true);
  const closeEditor = () => {
    setIsEditorOpen(false);
  };

  const saveChanges = async () => {
    setIsSaving(true);
    try {
      if (currentPlatform === 'both') {
        // Save to both platforms
        const configData = {
          layout_config: tempLayoutConfig,
          feature_flags: tempFeatureFlags,
          updated_at: new Date().toISOString(),
        };

        await Promise.all([
          // Update/create web config
          supabase.from('platform_ui_config')
            .upsert({
              page_name: currentPageName,
              platform: 'web',
              component_path: `src/pages/${currentPageName}.tsx`,
              ...configData,
              is_active: true,
            }),
          // Update/create android config
          supabase.from('platform_ui_config')
            .upsert({
              page_name: currentPageName,
              platform: 'android',
              component_path: `src/pages/${currentPageName}.tsx`,
              ...configData,
              is_active: true,
            })
        ]);

        toast.success('Configuración guardada para Web y Android');
        await loadPageConfig(currentPageName, currentPlatform);
        return;
      }

      const configData = {
        page_name: currentPageName,
        platform: currentPlatform,
        component_path: `src/pages/${currentPageName}.tsx`,
        layout_config: tempLayoutConfig,
        feature_flags: tempFeatureFlags,
        is_active: true,
      };

      if (originalConfig?.id) {
        // Update existing config
        const { error } = await supabase
          .from('platform_ui_config')
          .update({
            layout_config: tempLayoutConfig,
            feature_flags: tempFeatureFlags,
            updated_at: new Date().toISOString(),
          })
          .eq('id', originalConfig.id);

        if (error) throw error;
      } else {
        // Create new config
        const { error } = await supabase
          .from('platform_ui_config')
          .insert([configData]);

        if (error) throw error;
      }

      toast.success(`Configuración guardada para ${currentPlatform}`);
      await loadPageConfig(currentPageName, currentPlatform);
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const revertChanges = () => {
    if (originalConfig) {
      setTempLayoutConfig(originalConfig.layout_config || {});
      setTempFeatureFlags(originalConfig.feature_flags || {});
    }
  };

  const hasUnsavedChanges = 
    JSON.stringify(tempLayoutConfig) !== JSON.stringify(originalConfig?.layout_config || {}) ||
    JSON.stringify(tempFeatureFlags) !== JSON.stringify(originalConfig?.feature_flags || {});

  return (
    <PlatformEditorContext.Provider
      value={{
        isEditorOpen,
        openEditor,
        closeEditor,
        currentPlatform,
        setCurrentPlatform,
        currentPageName,
        setCurrentPageName,
        tempLayoutConfig,
        setTempLayoutConfig,
        tempFeatureFlags,
        setTempFeatureFlags,
        originalConfig,
        saveChanges,
        revertChanges,
        isSaving,
        hasUnsavedChanges,
        loadPageConfig,
      }}
    >
      {children}
    </PlatformEditorContext.Provider>
  );
};

export const usePlatformEditor = () => {
  const context = useContext(PlatformEditorContext);
  if (!context) {
    throw new Error('usePlatformEditor must be used within PlatformEditorProvider');
  }
  return context;
};
