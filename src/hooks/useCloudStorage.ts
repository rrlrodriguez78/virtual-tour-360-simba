import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Module-level variable to store popup reference (more reliable than state/ref)
let oauthPopupWindow: Window | null = null;

export interface BackupDestination {
  id: string;
  tenant_id: string;
  destination_type: 'cloud_storage' | 'local_download' | 'both';
  cloud_provider: 'google_drive' | 'dropbox' | null;
  cloud_folder_id: string | null;
  cloud_folder_path: string | null;
  auto_backup_enabled: boolean;
  backup_on_photo_upload: boolean;
  backup_frequency: string;
  is_active: boolean;
  last_backup_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncHistory {
  id: string;
  destination_id: string;
  backup_job_id: string;
  sync_type: string;
  status: string;
  files_synced: number;
  files_failed: number;
  total_size_bytes: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export function useCloudStorage(tenantId: string) {
  const [destinations, setDestinations] = useState<BackupDestination[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Function to load destinations (exposed so it can be called externally)
  const loadDestinations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('backup_destinations')
        .select(`
          id,
          tenant_id,
          destination_type,
          cloud_provider,
          cloud_folder_id,
          cloud_folder_path,
          backup_frequency,
          is_active,
          auto_backup_enabled,
          backup_on_photo_upload,
          last_backup_at,
          created_at,
          updated_at
        `)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      setDestinations((data as BackupDestination[]) || []);
    } catch (error: any) {
      console.error('Error loading destinations:', error);
      toast.error('Error loading backup destinations');
    }
  }, [tenantId]);

  const loadSyncHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('backup_sync_history')
        .select(`
          *,
          backup_destinations!inner(tenant_id)
        `)
        .eq('backup_destinations.tenant_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSyncHistory(data || []);
    } catch (error: any) {
      console.error('Error loading sync history:', error);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadDestinations();
      loadSyncHistory();
    }
  }, [tenantId, loadDestinations]);

  // Polling system to detect OAuth completion
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null;
    let pollingAttempts = 0;
    const MAX_POLLING_ATTEMPTS = 150; // 2 minutes (150 attempts x 800ms)

    const checkOAuthCompletion = async () => {
      if (!loadingProvider || loadingProvider === 'disconnecting' || 
          loadingProvider === 'testing' || loadingProvider === 'updating') {
        return;
      }

      pollingAttempts++;
      console.log(`🔍 Polling attempt ${pollingAttempts}/${MAX_POLLING_ATTEMPTS} - Checking for new OAuth connection...`);

      try {
        const { data, error } = await supabase
          .from('backup_destinations')
          .select(`
            id,
            tenant_id,
            destination_type,
            cloud_provider,
            cloud_folder_id,
            cloud_folder_path,
            backup_frequency,
            is_active,
            auto_backup_enabled,
            backup_on_photo_upload,
            last_backup_at,
            created_at,
            updated_at
          `)
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        // Check if we found a new active connection
        if (data && data.length > 0) {
          const newConnection = data[0] as BackupDestination;
          const isNew = !destinations.find(d => d.id === newConnection.id && d.is_active);

          if (isNew) {
            console.log('✅ OAuth completed! New connection detected:', newConnection);
            
            const providerName = newConnection.cloud_provider === 'google_drive' ? 'Google Drive' : 'Dropbox';
            toast.success(`${providerName} conectado exitosamente`);
            
            // Close OAuth popup from parent window if still open
            console.log('🔍 Checking popup reference:', {
              hasRef: !!oauthPopupWindow,
              isClosed: oauthPopupWindow?.closed
            });
            
            if (oauthPopupWindow && !oauthPopupWindow.closed) {
              try {
                oauthPopupWindow.close();
                console.log('✅ Popup cerrado desde ventana padre');
              } catch (e) {
                console.warn('⚠️ No se pudo cerrar el popup automáticamente:', e);
              }
            } else if (!oauthPopupWindow) {
              console.warn('⚠️ No hay referencia al popup');
            } else if (oauthPopupWindow.closed) {
              console.log('ℹ️ Popup ya estaba cerrado');
            }
            
            oauthPopupWindow = null;
            
            // Reload data
            await loadDestinations();
            await loadSyncHistory();
            
            // Clear loading state and stop polling
            setLoadingProvider(null);
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          }
        }

        // Stop polling after max attempts
        if (pollingAttempts >= MAX_POLLING_ATTEMPTS) {
          console.log('⏱️ Polling timeout reached');
          setLoadingProvider(null);
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    };

    // Start polling when OAuth flow begins
    if (loadingProvider && loadingProvider !== 'disconnecting' && 
        loadingProvider !== 'testing' && loadingProvider !== 'updating') {
      console.log('🚀 Starting OAuth polling system...');
      pollingInterval = setInterval(checkOAuthCompletion, 800); // Check every 800ms (2.5x faster)
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [loadingProvider, tenantId, destinations, loadDestinations]);

  const connectProvider = async (provider: 'google_drive' | 'dropbox') => {
    try {
      setLoadingProvider(provider);
      
      // Use edge function URL as redirect_uri - works on any domain
      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloud-storage-auth`;
      
      console.log('🔍 Starting OAuth flow:', {
        provider,
        tenantId,
        currentUrl: window.location.href,
        redirectUri: redirectUri,
        origin: window.location.origin
      });
      
      const { data, error } = await supabase.functions.invoke('cloud-storage-auth', {
        body: { 
          action: 'authorize',
          provider,
          tenant_id: tenantId,
          redirect_uri: redirectUri
        }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }

      console.log('✅ OAuth response received:', {
        hasAuthUrl: !!data.authUrl,
        authUrlLength: data.authUrl?.length,
        fullResponse: data
      });

      if (data.authUrl) {
        // Verify redirect_uri in OAuth URL
        const oauthUrl = new URL(data.authUrl);
        const redirectParam = oauthUrl.searchParams.get('redirect_uri');
        
        console.log('🔍 OAuth URL Analysis:', {
          host: oauthUrl.host,
          pathname: oauthUrl.pathname,
          redirectUriParam: redirectParam,
          expectedRedirectUri: redirectUri,
          redirectUriMatches: redirectParam === redirectUri
        });

        if (redirectParam !== redirectUri) {
          console.warn('⚠️ WARNING: redirect_uri mismatch!', {
            expected: redirectUri,
            received: redirectParam
          });
        }

        console.log('🚀 Opening OAuth window...');
        
        const oauthWindow = window.open(
          data.authUrl, 
          'google_oauth',
          'width=600,height=700,scrollbars=yes,location=yes'
        );
        
        if (!oauthWindow || oauthWindow.closed || typeof oauthWindow.closed === 'undefined') {
          console.log('⚠️ Popup blocked, using full page redirect...');
          // Use window.top to escape iframe if in preview
          if (window.top) {
            window.top.location.href = data.authUrl;
          } else {
            window.location.href = data.authUrl;
          }
        } else {
          console.log('✅ OAuth popup opened successfully');
          console.log('📊 Polling system will detect completion automatically...');
          
          // Save popup reference so we can close it from parent window
          oauthPopupWindow = oauthWindow;
          console.log('💾 Popup reference saved:', {
            hasRef: !!oauthPopupWindow,
            isClosed: oauthPopupWindow?.closed
          });
          
          // Note: We use polling system to detect OAuth completion
          // This is more reliable than postMessage in cross-origin scenarios
        }
      } else {
        console.error('❌ No authUrl in response:', data);
        toast.error('No authorization URL received');
      }
    } catch (error: any) {
      console.error('❌ Connect provider failed:', error);
      toast.error(`Error connecting to ${provider}: ${error.message}`);
      setLoadingProvider(null);
    }
  };

  const disconnectProvider = async (destinationId: string) => {
    try {
      setLoadingProvider('disconnecting');
      const { error } = await supabase
        .from('backup_destinations')
        .update({ is_active: false })
        .eq('id', destinationId);

      if (error) throw error;

      await loadDestinations();
      toast.success('Google Drive desconectado - Tus backups están seguros');
    } catch (error: any) {
      console.error('Error disconnecting provider:', error);
      toast.error('Error disconnecting provider');
    } finally {
      setLoadingProvider(null);
    }
  };

  const testConnection = async (destinationId: string) => {
    try {
      setLoadingProvider('testing');
      const { data, error } = await supabase.functions.invoke('cloud-storage-auth', {
        body: { 
          action: 'test-connection',
          destination_id: destinationId
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Connection test successful');
      } else {
        toast.error('Connection test failed');
      }

      return data.success;
    } catch (error: any) {
      console.error('Error testing connection:', error);
      toast.error('Error testing connection');
      return false;
    } finally {
      setLoadingProvider(null);
    }
  };

  const updateDestinationType = async (
    destinationId: string,
    type: 'cloud_storage' | 'local_download' | 'both'
  ) => {
    try {
      setLoadingProvider('updating');
      const { error } = await supabase
        .from('backup_destinations')
        .update({ destination_type: type })
        .eq('id', destinationId);

      if (error) throw error;

      await loadDestinations();
      toast.success('Destination type updated');
    } catch (error: any) {
      console.error('Error updating destination type:', error);
      toast.error('Error updating destination type');
    } finally {
      setLoadingProvider(null);
    }
  };

  const toggleAutoBackup = async (destinationId: string, enabled: boolean) => {
    try {
      setLoadingProvider('updating');
      const { error } = await supabase
        .from('backup_destinations')
        .update({ auto_backup_enabled: enabled })
        .eq('id', destinationId);

      if (error) throw error;

      await loadDestinations();
      toast.success(`Auto-backup ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      console.error('Error toggling auto-backup:', error);
      toast.error('Error updating auto-backup setting');
    } finally {
      setLoadingProvider(null);
    }
  };

  const getActiveDestination = () => {
    return destinations.find(d => d.is_active) || null;
  };

  const clearSyncHistory = async () => {
    try {
      const activeDestination = getActiveDestination();
      if (!activeDestination) {
        throw new Error('No active destination found');
      }

      const { error } = await supabase
        .from('backup_sync_history')
        .delete()
        .eq('destination_id', activeDestination.id);
      
      if (error) throw error;
      
      await loadSyncHistory();
    } catch (error: any) {
      console.error('Error clearing sync history:', error);
      throw error;
    }
  };

  return {
    destinations,
    syncHistory,
    loadingProvider,
    connectProvider,
    disconnectProvider,
    testConnection,
    updateDestinationType,
    toggleAutoBackup,
    loadDestinations,
    loadSyncHistory,
    getActiveDestination,
    clearSyncHistory
  };
}
