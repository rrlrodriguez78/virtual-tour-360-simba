import { useState, useEffect, useCallback, useRef } from 'react';
import { hybridStorage } from '@/utils/hybridStorage';
import { offlineStorage } from '@/utils/offlineStorage';
import { supabase } from '@/integrations/supabase/custom-client';
import { toast } from 'sonner';
import { useThetaWiFiDetector } from './useThetaWiFiDetector';
import { useUserSettingsContext } from '@/contexts/UserSettingsContext';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingPhotosCount: number;
  cachedToursCount: number;
  syncProgress: number;
  currentOperation: string | null;
}

interface SyncOptions {
  autoSync?: boolean;
  syncInterval?: number; // minutos
  maxRetries?: number;
}

/**
 * Hook avanzado para sincronización inteligente offline/online
 * - Detecta cambios de red de forma robusta
 * - Sincroniza automáticamente cuando vuelve la conexión
 * - Reintentos automáticos con backoff exponencial
 * - Progreso detallado de sincronización
 */
export function useIntelligentSync(options: SyncOptions = {}) {
  const {
    autoSync = true,
    syncInterval = 5,
    maxRetries = 3,
  } = options;

  const { settings } = useUserSettingsContext();

  const [state, setState] = useState<SyncState>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncAt: null,
    pendingPhotosCount: 0,
    cachedToursCount: 0,
    syncProgress: 0,
    currentOperation: null,
  });

  const syncInProgressRef = useRef(false);
  const retryCountRef = useRef(0);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Detectar WiFi de Theta para evitar sincronizaciones innecesarias
  const { isThetaWiFi, hasRealInternet } = useThetaWiFiDetector();
  
  // Get sync interval from user settings
  const getSyncIntervalMinutes = useCallback((frequency: string): number => {
    switch(frequency) {
      case 'hourly': return 60;
      case 'daily': return 1440;
      case 'weekly': return 10080;
      case 'manual': return 0; // Disabled
      default: return 5; // Default
    }
  }, []);

  // Actualizar contadores
  const updateCounts = useCallback(async () => {
    try {
      const [pendingCount, cachedTours] = await Promise.all([
        offlineStorage.getAllPendingCount(),
        hybridStorage.listTours(),
      ]);

      setState(prev => ({
        ...prev,
        pendingPhotosCount: pendingCount,
        cachedToursCount: cachedTours.length,
      }));
    } catch (error) {
      console.error('Error updating counts:', error);
    }
  }, []);

  // Detectar cambios de red con verificación real
  const checkOnlineStatus = useCallback(async () => {
    // Si estamos en WiFi de Theta, no hay internet real
    if (isThetaWiFi) {
      return false;
    }
    
    if (!navigator.onLine) {
      return false;
    }

    try {
      // Verificar conectividad real con Supabase
      const { error } = await supabase.from('profiles').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }, [isThetaWiFi]);

  // Sincronizar fotos pendientes con reintentos
  const syncPendingPhotos = useCallback(async () => {
    // Check if cloud sync is enabled in settings
    if (!settings.cloud_sync) {
      console.log('⚠️ Cloud sync disabled in user settings');
      return { success: false, message: 'Sync disabled in settings' };
    }
    
    // No sincronizar si estamos en WiFi de Theta
    if (isThetaWiFi) {
      console.log('⚠️ En WiFi de Theta - sincronización deshabilitada');
      return { success: false, message: 'Connected to Theta WiFi' };
    }
    
    if (syncInProgressRef.current) {
      console.log('Sync already in progress, skipping');
      return { success: false, message: 'Sync in progress' };
    }

    const online = await checkOnlineStatus();
    if (!online) {
      console.log('No internet connection, skipping sync');
      return { success: false, message: 'No internet connection' };
    }

    syncInProgressRef.current = true;
    setState(prev => ({ ...prev, isSyncing: true, syncProgress: 0, currentOperation: 'Preparando...' }));

    try {
      const pendingPhotos = await offlineStorage.getPendingPhotos();
      
      if (pendingPhotos.length === 0) {
        setState(prev => ({ 
          ...prev, 
          isSyncing: false, 
          syncProgress: 100,
          currentOperation: null,
          lastSyncAt: new Date() 
        }));
        syncInProgressRef.current = false;
        return { success: true, message: 'No pending photos' };
      }

      console.log(`🔄 Sincronizando ${pendingPhotos.length} fotos pendientes...`);
      
      let successCount = 0;
      let errorCount = 0;
      const totalPhotos = pendingPhotos.length;

      // Procesar de 3 en 3 para no saturar
      for (let i = 0; i < pendingPhotos.length; i += 3) {
        const batch = pendingPhotos.slice(i, i + 3);
        
        await Promise.all(
          batch.map(async (photo, batchIndex) => {
            const photoIndex = i + batchIndex + 1;
            
            try {
              setState(prev => ({ 
                ...prev, 
                currentOperation: `Sincronizando ${photoIndex}/${totalPhotos}`,
                syncProgress: Math.round((photoIndex / totalPhotos) * 100)
              }));

              await offlineStorage.updatePhotoStatus(photo.id, 'syncing');

              // Subir foto a storage y crear registro en DB
              const file = new File([photo.blob], photo.filename, { type: photo.blob.type });
              const filePath = `${photo.tenantId}/${photo.tourId}/${photo.hotspotId}/${Date.now()}.jpg`;
              
              const { error: uploadError } = await supabase.storage
                .from('tour-images')
                .upload(filePath, file, {
                  contentType: 'image/jpeg',
                  upsert: false,
                });

              if (uploadError) throw uploadError;

              const { data: { publicUrl } } = supabase.storage
                .from('tour-images')
                .getPublicUrl(filePath);

              // Crear registro en panorama_photos
              const { error: dbError } = await supabase
                .from('panorama_photos')
                .insert({
                  hotspot_id: photo.hotspotId,
                  photo_url: publicUrl,
                  original_filename: photo.filename,
                  capture_date: photo.captureDate.toISOString().split('T')[0],
                });

              if (dbError) throw dbError;

              // Limpiar foto sincronizada
              await offlineStorage.deletePhoto(photo.id);
              successCount++;
              
            } catch (error: any) {
              console.error(`Error sincronizando foto ${photo.id}:`, error);
              await offlineStorage.updatePhotoStatus(photo.id, 'error', error.message);
              errorCount++;
            }
          })
        );
      }

      const message = successCount > 0
        ? `✅ ${successCount} fotos sincronizadas${errorCount > 0 ? `, ${errorCount} fallaron` : ''}`
        : `❌ ${errorCount} fotos fallaron`;

      if (successCount > 0) {
        toast.success(message);
        retryCountRef.current = 0; // Reset retry count on success
      } else {
        toast.error(message);
      }

      setState(prev => ({ 
        ...prev, 
        isSyncing: false,
        syncProgress: 100,
        currentOperation: null,
        lastSyncAt: new Date(),
      }));

      await updateCounts();
      
      syncInProgressRef.current = false;
      return { 
        success: successCount > 0, 
        message,
        successCount,
        errorCount 
      };

    } catch (error: any) {
      console.error('Error en sincronización:', error);
      setState(prev => ({ 
        ...prev, 
        isSyncing: false, 
        syncProgress: 0,
        currentOperation: null 
      }));
      
      syncInProgressRef.current = false;
      
      // Reintentar con backoff exponencial
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.pow(2, retryCountRef.current) * 1000; // 2s, 4s, 8s
        
        toast.warning(`Error al sincronizar. Reintentando en ${delay/1000}s... (${retryCountRef.current}/${maxRetries})`);
        
        setTimeout(() => {
          syncPendingPhotos();
        }, delay);
      } else {
        toast.error('Error al sincronizar fotos después de varios intentos');
        retryCountRef.current = 0;
      }
      
      return { success: false, message: error.message };
    }
  }, [checkOnlineStatus, maxRetries, updateCounts, isThetaWiFi, settings.cloud_sync]);

  // Sincronizar cambios remotos (detectar actualizaciones del servidor)
  const syncRemoteChanges = useCallback(async () => {
    if (!settings.cloud_sync || !settings.sync_data_types.tours) {
      return;
    }
    
    if (isThetaWiFi) {
      return;
    }
    
    const online = await checkOnlineStatus();
    if (!online) return;

    try {
      setState(prev => ({ ...prev, currentOperation: 'Verificando cambios remotos...' }));
      
      const downloadedTours = await hybridStorage.listTours();
      
      for (const localTour of downloadedTours) {
        const { data: remoteTour } = await supabase
          .from('virtual_tours')
          .select('id, updated_at, title')
          .eq('id', localTour.id)
          .single();

        if (!remoteTour) continue;

        const localSyncTime = localTour.lastSyncedAt ? new Date(localTour.lastSyncedAt) : new Date(0);
        const remoteUpdateTime = new Date(remoteTour.updated_at);

        if (remoteUpdateTime > localSyncTime) {
          console.log(`🔄 Cambios remotos detectados: ${remoteTour.title}`);
          
          if (localTour.hasLocalChanges) {
            toast.warning(`⚠️ Conflicto en "${remoteTour.title}"`, {
              description: 'Tienes cambios locales y hay actualizaciones remotas',
              duration: 5000,
            });
          } else {
            toast.info(`⬇️ Actualizando "${remoteTour.title}"`);
          }
        }
      }
      
      setState(prev => ({ ...prev, currentOperation: null }));
      
    } catch (error) {
      console.error('Error syncing remote changes:', error);
      setState(prev => ({ ...prev, currentOperation: null }));
    }
  }, [checkOnlineStatus, isThetaWiFi, settings.cloud_sync, settings.sync_data_types.tours]);

  // Actualizar cache de tours (descargar actualizaciones)
  const updateCachedTours = useCallback(async () => {
    // Check if tours sync is enabled
    if (!settings.cloud_sync || !settings.sync_data_types.tours) {
      console.log('⚠️ Tours sync disabled in user settings');
      return;
    }
    
    // No actualizar si estamos en WiFi de Theta
    if (isThetaWiFi) {
      console.log('⚠️ En WiFi de Theta - actualización de cache deshabilitada');
      return;
    }
    
    const online = await checkOnlineStatus();
    if (!online) return;

    try {
      setState(prev => ({ ...prev, currentOperation: 'Actualizando tours en caché...' }));
      
      const cachedTours = await hybridStorage.listTours();
      
      setState(prev => ({ ...prev, currentOperation: null }));
      toast.success(`✅ ${cachedTours.length} tours verificados`);
      
    } catch (error) {
      console.error('Error updating cached tours:', error);
      setState(prev => ({ ...prev, currentOperation: null }));
    }
  }, [checkOnlineStatus, isThetaWiFi, settings.cloud_sync, settings.sync_data_types.tours]);

  // Sincronización completa
  const performFullSync = useCallback(async () => {
    console.log('🔄 Iniciando sincronización completa...');
    
    // 1. Sincronizar fotos pendientes
    await syncPendingPhotos();
    
    // 2. Verificar cambios remotos
    await syncRemoteChanges();
    
    // 3. Actualizar tours en caché
    await updateCachedTours();
    
    console.log('✅ Sincronización completa finalizada');
  }, [syncPendingPhotos, syncRemoteChanges, updateCachedTours]);

  // Monitorear estado de red
  useEffect(() => {
    const handleOnline = async () => {
      console.log('🌐 Conexión detectada, verificando...');
      
      // Si estamos en WiFi de Theta, no es internet real
      if (isThetaWiFi) {
        console.log('⚠️ Conexión detectada es WiFi de Theta, no internet real');
        setState(prev => ({ ...prev, isOnline: false }));
        return;
      }
      
      const reallyOnline = await checkOnlineStatus();
      
      setState(prev => ({ ...prev, isOnline: reallyOnline }));
      
      if (reallyOnline) {
        toast.success('🌐 Conexión a internet restaurada');
        if (autoSync) {
          setTimeout(() => performFullSync(), 1000); // Dar 1s para estabilizar
        }
      }
    };

    const handleOffline = () => {
      console.log('📴 Sin conexión');
      setState(prev => ({ ...prev, isOnline: false }));
      
      // Solo mostrar toast si no estamos cambiando a WiFi de Theta
      if (!isThetaWiFi) {
        toast.warning('📴 Sin conexión - Modo offline activo');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificación periódica
    const intervalId = setInterval(async () => {
      // Siempre offline si estamos en WiFi de Theta
      if (isThetaWiFi) {
        setState(prev => {
          if (prev.isOnline !== false) {
            console.log('📴 Cambiado a WiFi de Theta');
          }
          return { ...prev, isOnline: false };
        });
        return;
      }
      
      const online = await checkOnlineStatus();
      setState(prev => {
        if (prev.isOnline !== online) {
          if (online) {
            toast.success('🌐 Conexión a internet restaurada');
            if (autoSync) performFullSync();
          } else {
            toast.warning('📴 Conexión perdida');
          }
        }
        return { ...prev, isOnline: online };
      });
    }, 30000); // Cada 30s

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [checkOnlineStatus, autoSync, performFullSync, isThetaWiFi]);

  // Sincronización periódica automática
  useEffect(() => {
    const userSyncInterval = getSyncIntervalMinutes(settings.backup_frequency);
    
    // If manual or sync disabled, don't set up interval
    if (!autoSync || userSyncInterval === 0 || !settings.cloud_sync) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }
    
    if (userSyncInterval > 0) {
      syncIntervalRef.current = setInterval(() => {
        if (state.isOnline && !syncInProgressRef.current) {
          performFullSync();
        }
      }, userSyncInterval * 60 * 1000);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [autoSync, settings.backup_frequency, settings.cloud_sync, state.isOnline, performFullSync, getSyncIntervalMinutes]);

  // Cargar contadores iniciales
  useEffect(() => {
    updateCounts();
  }, [updateCounts]);

  return {
    ...state,
    syncNow: performFullSync,
    syncPhotos: syncPendingPhotos,
    updateTours: updateCachedTours,
    syncRemoteChanges,
    refreshCounts: updateCounts,
  };
}
