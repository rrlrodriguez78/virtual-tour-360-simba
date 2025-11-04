import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/custom-client';
import { hybridStorage } from '@/utils/hybridStorage';
import { toast } from 'sonner';
import { SyncEvents } from '@/services/sync-events';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingChanges: number;
  lastSyncAt: Date | null;
  hasConflicts: boolean;
  conflictingTours: Array<{
    tourId: string;
    tourName: string;
    localVersion: any;
    remoteVersion: any;
  }>;
}

export function useCloudSync() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingChanges: 0,
    lastSyncAt: null,
    hasConflicts: false,
    conflictingTours: []
  });

  const isSyncingRef = useRef(false);

  // 🔄 Escuchar cambios remotos en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel('tours_realtime_sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'virtual_tours'
      }, async (payload) => {
        console.log('🔔 Cambio remoto detectado:', payload);
        
        try {
          const tourId = (payload.new as any)?.id || (payload.old as any)?.id;
          if (!tourId) return;

          // Verificar si hay conflicto
          const localTour = await hybridStorage.loadTour(tourId);
          
          // Get metadata for hasLocalChanges flag
          const metadataKey = `tour_metadata_${tourId}`;
          const metadata = JSON.parse(localStorage.getItem(metadataKey) || '{}');
          
          if (localTour && metadata.hasLocalChanges) {
            const localUpdated = new Date((localTour.data as any).updated_at || metadata.lastModified || new Date());
            const remoteUpdated = new Date((payload.new as any).updated_at);
            
            if (localUpdated > remoteUpdated) {
              // Conflicto detectado
              setStatus(prev => ({
                ...prev,
                hasConflicts: true,
                conflictingTours: [
                  ...prev.conflictingTours.filter(t => t.tourId !== tourId),
                  {
                    tourId,
                    tourName: (payload.new as any).title || 'Tour sin nombre',
                    localVersion: localTour.data,
                    remoteVersion: payload.new
                  }
                ]
              }));
              toast.warning('Conflicto detectado - Se requiere tu atención', {
                description: `El tour "${(payload.new as any).title}" tiene cambios locales y remotos`
              });
              return;
            }
          }

          // Sin conflicto: actualizar cache local automáticamente
          if (payload.eventType === 'DELETE') {
            await hybridStorage.deleteTour(tourId);
            SyncEvents.notifyDataChanged('virtual_tours', 'delete', tourId);
            toast.info('Tour eliminado desde la nube');
          } else {
            // Actualizar solo si no hay cambios locales pendientes
            const metadataKey = `tour_metadata_${tourId}`;
            const metadata = JSON.parse(localStorage.getItem(metadataKey) || '{}');
            
            if (!localTour || !metadata.hasLocalChanges) {
              const { data: fullTour, error } = await supabase
                .from('virtual_tours')
                .select(`
                  *,
                  floor_plans(*),
                  floor_plans(hotspots(*))
                `)
                .eq('id', tourId)
                .single();

              if (!error && fullTour) {
                await hybridStorage.saveTour(
                  fullTour.id,
                  fullTour.title,
                  fullTour as any,
                  fullTour.floor_plans || [],
                  fullTour.floor_plans?.flatMap((fp: any) => fp.hotspots || []) || []
                );
                SyncEvents.notifyDataChanged('virtual_tours', 'update', tourId);
                toast.success('Tour actualizado desde la nube', {
                  description: fullTour.title
                });
              }
            }
          }
        } catch (error) {
          console.error('Error procesando cambio remoto:', error);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 🌐 Monitorear conexión
  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 Conexión restaurada');
      setStatus(prev => ({ ...prev, isOnline: true }));
      // Auto-sync al reconectar después de 2 segundos
      setTimeout(() => {
        if (!isSyncingRef.current) {
          syncNow();
        }
      }, 2000);
    };
    
    const handleOffline = () => {
      console.log('🔴 Conexión perdida');
      setStatus(prev => ({ ...prev, isOnline: false }));
      toast.error('Sin conexión a internet', {
        description: 'Los cambios se guardarán localmente'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ⏰ Auto-sync cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (status.isOnline && !status.isSyncing && !isSyncingRef.current) {
        syncNow(true); // silent mode
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [status.isOnline, status.isSyncing]);

  // 📊 Actualizar contador de cambios pendientes
  const updatePendingCount = useCallback(async () => {
    try {
      const tours = await hybridStorage.listTours();
      const pending = tours.filter(t => {
        const metadataKey = `tour_metadata_${t.id}`;
        const metadata = JSON.parse(localStorage.getItem(metadataKey) || '{}');
        return metadata.hasLocalChanges === true;
      }).length;
      setStatus(prev => ({ ...prev, pendingChanges: pending }));
    } catch (error) {
      console.error('Error actualizando contador:', error);
    }
  }, []);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // 📤 Sincronizar cambios locales con la nube
  const syncNow = useCallback(async (silent = false) => {
    if (!status.isOnline) {
      if (!silent) {
        toast.error('Sin conexión a internet');
      }
      return;
    }

    if (isSyncingRef.current) {
      console.log('⏸️ Sync ya en progreso, omitiendo...');
      return;
    }

    isSyncingRef.current = true;
    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      // Obtener tours con cambios pendientes
      const tours = await hybridStorage.listTours();
      const toursToSync = tours.filter(t => {
        const metadataKey = `tour_metadata_${t.id}`;
        const metadata = JSON.parse(localStorage.getItem(metadataKey) || '{}');
        return metadata.hasLocalChanges === true;
      });

      if (toursToSync.length === 0) {
        if (!silent) {
          toast.info('Todo está sincronizado');
        }
        setStatus(prev => ({ 
          ...prev, 
          isSyncing: false,
          lastSyncAt: new Date()
        }));
        isSyncingRef.current = false;
        return;
      }

      let syncedCount = 0;
      let errorCount = 0;

      for (const tourInfo of toursToSync) {
        try {
          const tourData = await hybridStorage.loadTour(tourInfo.id);
          if (!tourData) continue;

          // Verificar conflictos antes de subir
          const { data: remoteTour } = await supabase
            .from('virtual_tours')
            .select('updated_at')
            .eq('id', tourInfo.id)
            .single();

          if (remoteTour) {
            const metadataKey = `tour_metadata_${tourInfo.id}`;
            const metadata = JSON.parse(localStorage.getItem(metadataKey) || '{}');
            const localUpdated = new Date((tourData.data as any).updated_at || metadata.lastModified || new Date());
            const remoteUpdated = new Date(remoteTour.updated_at);

            if (remoteUpdated > localUpdated) {
              // Hay una versión más nueva en el servidor
              toast.warning(`Conflicto: "${tourInfo.name}" tiene cambios remotos más recientes`);
              errorCount++;
              continue;
            }
          }

          // Subir tour
          const { error: tourError } = await supabase
            .from('virtual_tours')
            .upsert({
              ...tourData.data,
              updated_at: new Date().toISOString()
            } as any);

          if (tourError) throw tourError;

          // Subir floor plans
          if ((tourData as any).floorPlans?.length > 0) {
            const { error: fpError } = await supabase
              .from('floor_plans')
              .upsert((tourData as any).floorPlans);
            
            if (fpError) throw fpError;
          }

          // Subir hotspots
          if ((tourData as any).hotspots?.length > 0) {
            const { error: hsError } = await supabase
              .from('hotspots')
              .upsert((tourData as any).hotspots);
            
            if (hsError) throw hsError;
          }

          // Marcar como sincronizado
          await hybridStorage.markTourSynced(tourInfo.id);
          SyncEvents.notifyDataChanged('virtual_tours', 'sync', tourInfo.id);
          syncedCount++;

        } catch (error) {
          console.error(`Error sincronizando tour ${tourInfo.id}:`, error);
          errorCount++;
        }
      }

      // Actualizar estado
      await updatePendingCount();
      
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date()
      }));

      if (!silent && syncedCount > 0) {
        toast.success(`✅ ${syncedCount} tour${syncedCount > 1 ? 's' : ''} sincronizado${syncedCount > 1 ? 's' : ''}`);
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} tour${errorCount > 1 ? 's' : ''} con errores`);
      }

    } catch (error) {
      console.error('Error en sync:', error);
      toast.error('Error al sincronizar cambios');
    } finally {
      isSyncingRef.current = false;
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [status.isOnline, updatePendingCount]);

  // 🔧 Resolver conflicto
  const resolveConflict = useCallback(async (
    tourId: string, 
    resolution: 'local' | 'remote'
  ) => {
    try {
      const conflict = status.conflictingTours.find(c => c.tourId === tourId);
      if (!conflict) return;

      if (resolution === 'local') {
        // Subir versión local a la nube (forzar)
        const tourData = await hybridStorage.loadTour(tourId);
        if (!tourData) return;

        const { error } = await supabase
          .from('virtual_tours')
          .upsert({
            ...tourData.data,
            updated_at: new Date().toISOString()
          } as any);

        if (error) throw error;

        await hybridStorage.markTourSynced(tourId);
        toast.success('Conflicto resuelto: Tu versión se guardó en la nube');

      } else {
        // Descargar versión remota (sobrescribir local)
        const { data: remoteTour, error } = await supabase
          .from('virtual_tours')
          .select(`
            *,
            floor_plans(*),
            floor_plans(hotspots(*))
          `)
          .eq('id', tourId)
          .single();

        if (error) throw error;

        await hybridStorage.saveTour(
          remoteTour.id,
          remoteTour.title,
          remoteTour as any,
          remoteTour.floor_plans || [],
          remoteTour.floor_plans?.flatMap((fp: any) => fp.hotspots || []) || []
        );

        toast.success('Conflicto resuelto: Versión de la nube descargada');
      }

      // Remover conflicto de la lista
      setStatus(prev => ({
        ...prev,
        conflictingTours: prev.conflictingTours.filter(c => c.tourId !== tourId),
        hasConflicts: prev.conflictingTours.length > 1
      }));

      await updatePendingCount();

    } catch (error) {
      console.error('Error resolviendo conflicto:', error);
      toast.error('Error al resolver conflicto');
    }
  }, [status.conflictingTours, updatePendingCount]);

  return {
    status,
    syncNow,
    resolveConflict,
    refreshPendingCount: updatePendingCount
  };
}
