import { useState, useEffect, useCallback } from 'react';
import { offlineTourStorage, OfflineTour, OfflinePhoto } from '@/utils/offlineTourStorage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createImageVersions } from '@/utils/imageOptimization';

interface OfflineTourStatus {
  isDownloading: boolean;
  isSyncing: boolean;
  downloadedTours: OfflineTour[];
  storageInfo: { tours: number; sizeMB: number };
  error: string | null;
}

export const useOfflineTours = (tenantId?: string) => {
  const [status, setStatus] = useState<OfflineTourStatus>({
    isDownloading: false,
    isSyncing: false,
    downloadedTours: [],
    storageInfo: { tours: 0, sizeMB: 0 },
    error: null,
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitorear estado de la red
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🌐 Conexión restaurada - Listo para sincronizar');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.info('📡 Modo offline - Puedes seguir trabajando');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar tours descargados y estadísticas
  const loadOfflineTours = useCallback(async () => {
    try {
      const tours = await offlineTourStorage.getDownloadedTours(tenantId);
      const storage = await offlineTourStorage.getStorageSize();
      
      setStatus(prev => ({
        ...prev,
        downloadedTours: tours,
        storageInfo: storage
      }));
    } catch (error) {
      console.error('Error loading offline tours:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    loadOfflineTours();
  }, [loadOfflineTours]);

  /**
   * Descarga un tour completo para trabajo offline
   */
  const downloadTour = useCallback(async (tourId: string): Promise<boolean> => {
    setStatus(prev => ({ ...prev, isDownloading: true, error: null }));

    try {
      // 1. Obtener datos del tour
      const { data: tourData, error: tourError } = await supabase
        .from('virtual_tours')
        .select('*')
        .eq('id', tourId)
        .single();

      if (tourError) throw tourError;

      // 2. Obtener floor plans
      const { data: floorPlans, error: floorPlansError } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('tour_id', tourId);

      if (floorPlansError) throw floorPlansError;

      // 3. Obtener hotspots para cada floor plan
      const offlineFloorPlans = [];
      for (const floorPlan of floorPlans || []) {
        const { data: hotspots } = await supabase
          .from('hotspots')
          .select('*')
          .eq('floor_plan_id', floorPlan.id);

        // 4. Obtener fotos para cada hotspot
        const offlineHotspots = [];
        for (const hotspot of hotspots || []) {
          const { data: photos } = await supabase
            .from('panorama_photos')
            .select('*')
            .eq('hotspot_id', hotspot.id)
            .order('display_order');

          // Descargar blobs de las fotos
          const offlinePhotos = await Promise.all((photos || []).map(async (photo) => {
            try {
              const response = await fetch(photo.photo_url);
              const blob = await response.blob();
              return {
                ...photo,
                photo_blob: blob
              };
            } catch (err) {
              console.error('Error downloading photo:', err);
              return photo;
            }
          }));

          offlineHotspots.push({
            ...hotspot,
            photos: offlinePhotos
          });
        }

        // Descargar imagen del floor plan
        let floorPlanBlob: Blob | undefined;
        try {
          const response = await fetch(floorPlan.image_url);
          floorPlanBlob = await response.blob();
        } catch (err) {
          console.error('Error downloading floor plan:', err);
        }

        offlineFloorPlans.push({
          ...floorPlan,
          image_blob: floorPlanBlob,
          hotspots: offlineHotspots
        });
      }

      // 5. Guardar tour offline
      const offlineTour: OfflineTour = {
        id: tourData.id,
        title: tourData.title,
        description: tourData.description || '',
        tenant_id: tourData.tenant_id,
        tour_type: (tourData.tour_type || 'tour_360') as 'tour_360' | 'photo_tour',
        cover_image_url: tourData.cover_image_url,
        downloadedAt: new Date(),
        lastModifiedAt: new Date(),
        status: 'downloaded',
        localChanges: {
          newPhotos: 0,
          editedMetadata: false
        },
        floorPlans: offlineFloorPlans
      };

      await offlineTourStorage.saveTour(offlineTour);
      await loadOfflineTours();

      toast.success(`✅ Tour "${tourData.title}" descargado para trabajo offline`);
      return true;

    } catch (error) {
      console.error('Error downloading tour:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      setStatus(prev => ({ ...prev, error: errorMsg }));
      toast.error(`Error al descargar tour: ${errorMsg}`);
      return false;
    } finally {
      setStatus(prev => ({ ...prev, isDownloading: false }));
    }
  }, [loadOfflineTours]);

  /**
   * Sincroniza cambios locales con el servidor
   */
  const syncLocalChanges = useCallback(async (): Promise<void> => {
    if (!isOnline) {
      toast.warning('Sin conexión a internet');
      return;
    }

    setStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const modifiedTours = await offlineTourStorage.getModifiedTours();
      
      if (modifiedTours.length === 0) {
        toast.info('No hay cambios para sincronizar');
        return;
      }

      toast.info(`Sincronizando ${modifiedTours.length} tour(s) modificado(s)...`);

      for (const tour of modifiedTours) {
        try {
          await offlineTourStorage.updateTourStatus(tour.id, 'syncing');

          // 1. Sincronizar metadata si cambió
          if (tour.localChanges.editedMetadata) {
            await supabase
              .from('virtual_tours')
              .update({
                title: tour.title,
                description: tour.description
              })
              .eq('id', tour.id);
          }

          // 2. Sincronizar nuevas fotos
          if (tour.localChanges.newPhotos > 0) {
            for (const floorPlan of tour.floorPlans) {
              for (const hotspot of floorPlan.hotspots) {
                const newPhotos = hotspot.photos.filter(p => p.isNew);
                
                for (const photo of newPhotos) {
                  if (!photo.photo_blob) continue;

                  // Crear versiones optimizadas
                  const file = new File([photo.photo_blob], `photo_${Date.now()}.jpg`, { 
                    type: photo.photo_blob.type 
                  });

                  const versions = await createImageVersions(file, [
                    { name: 'original', options: { maxWidth: 4000, quality: 0.85, format: 'webp', maxSizeMB: 10 } },
                    { name: 'mobile', options: { maxWidth: 1920, quality: 0.85, format: 'webp', maxSizeMB: 10 } },
                    { name: 'thumbnail', options: { maxWidth: 400, quality: 0.8, format: 'webp', maxSizeMB: 10 } }
                  ]);

                  // Subir fotos
                  const uploadPath = `${tour.tenant_id}/${tour.id}/${hotspot.id}`;
                  const timestamp = Date.now();
                  
                  const originalUpload = await supabase.storage
                    .from('panorama_photos')
                    .upload(`${uploadPath}/${timestamp}_original.webp`, versions.original.blob);

                  if (originalUpload.error) throw originalUpload.error;

                  const mobileUpload = await supabase.storage
                    .from('panorama_photos')
                    .upload(`${uploadPath}/${timestamp}_mobile.webp`, versions.mobile.blob);

                  const thumbnailUpload = await supabase.storage
                    .from('panorama_photos')
                    .upload(`${uploadPath}/${timestamp}_thumbnail.webp`, versions.thumbnail.blob);

                  // Obtener URLs públicas
                  const { data: originalUrl } = supabase.storage
                    .from('panorama_photos')
                    .getPublicUrl(originalUpload.data.path);

                  const { data: mobileUrl } = mobileUpload.data ? supabase.storage
                    .from('panorama_photos')
                    .getPublicUrl(mobileUpload.data.path) : { data: null };

                  const { data: thumbnailUrl } = thumbnailUpload.data ? supabase.storage
                    .from('panorama_photos')
                    .getPublicUrl(thumbnailUpload.data.path) : { data: null };

                  // Insertar en DB
                  const { error: insertError } = await supabase
                    .from('panorama_photos')
                    .insert({
                      hotspot_id: hotspot.id,
                      photo_url: originalUrl.publicUrl,
                      photo_url_mobile: mobileUrl?.publicUrl,
                      photo_url_thumbnail: thumbnailUrl?.publicUrl,
                      description: photo.description,
                      display_order: photo.display_order,
                      capture_date: photo.capture_date
                    });

                  if (insertError) throw insertError;
                }
              }
            }
          }

          // Marcar como sincronizado
          await offlineTourStorage.updateTourStatus(tour.id, 'downloaded');
          tour.localChanges = { newPhotos: 0, editedMetadata: false };
          await offlineTourStorage.saveTour(tour);

        } catch (error) {
          console.error(`Error syncing tour ${tour.id}:`, error);
          await offlineTourStorage.updateTourStatus(
            tour.id, 
            'error',
            error instanceof Error ? error.message : 'Error desconocido'
          );
        }
      }

      await loadOfflineTours();
      toast.success('✅ Sincronización completada');

    } catch (error) {
      console.error('Error syncing changes:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      setStatus(prev => ({ ...prev, error: errorMsg }));
      toast.error(`Error al sincronizar: ${errorMsg}`);
    } finally {
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [isOnline, loadOfflineTours]);

  /**
   * Elimina un tour descargado
   */
  const deleteTour = useCallback(async (tourId: string): Promise<void> => {
    try {
      await offlineTourStorage.deleteTour(tourId);
      await loadOfflineTours();
      toast.success('Tour eliminado del almacenamiento offline');
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error('Error al eliminar tour');
    }
  }, [loadOfflineTours]);

  /**
   * Limpia tours antiguos
   */
  const cleanOldTours = useCallback(async (daysOld: number = 30): Promise<void> => {
    try {
      const deletedCount = await offlineTourStorage.cleanOldTours(daysOld);
      await loadOfflineTours();
      if (deletedCount > 0) {
        toast.success(`${deletedCount} tour(s) antiguo(s) eliminado(s)`);
      } else {
        toast.info('No hay tours antiguos para limpiar');
      }
    } catch (error) {
      console.error('Error cleaning old tours:', error);
      toast.error('Error al limpiar tours antiguos');
    }
  }, [loadOfflineTours]);

  return {
    ...status,
    isOnline,
    downloadTour,
    syncLocalChanges,
    deleteTour,
    cleanOldTours,
    refreshTours: loadOfflineTours
  };
};
