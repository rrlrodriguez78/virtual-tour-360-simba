import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineStorage, PendingPhoto } from '@/utils/offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { createImageVersions } from '@/utils/imageOptimization';
import { toast } from 'sonner';

interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  error: string | null;
}

export const useOfflineSync = (hotspotId?: string) => {
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    error: null,
  });

  const syncInProgressRef = useRef(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitorear estado de la red
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🌐 Conexión a internet restaurada - Sincronizando fotos...');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('📡 Sin conexión - Las fotos se guardarán para sincronizar después');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar contador de fotos pendientes
  const loadPendingCount = useCallback(async () => {
    try {
      let count: number;
      if (hotspotId) {
        const photos = await offlineStorage.getPendingPhotosByHotspot(hotspotId);
        count = photos.length;
      } else {
        count = await offlineStorage.getAllPendingCount();
      }
      setStatus(prev => ({ ...prev, pendingCount: count }));
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  }, [hotspotId]);

  // Sincronizar fotos pendientes
  const syncPendingPhotos = useCallback(async () => {
    if (syncInProgressRef.current || !isOnline) {
      return;
    }

    syncInProgressRef.current = true;
    setStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const pendingPhotos = await offlineStorage.getPendingPhotos();
      
      if (pendingPhotos.length === 0) {
        syncInProgressRef.current = false;
        setStatus(prev => ({ ...prev, isSyncing: false }));
        return;
      }

      console.log(`Sincronizando ${pendingPhotos.length} fotos pendientes...`);
      toast.info(`Sincronizando ${pendingPhotos.length} foto(s)...`, { duration: 3000 });

      let successCount = 0;
      let errorCount = 0;

      for (const photo of pendingPhotos) {
        try {
          await offlineStorage.updatePhotoStatus(photo.id, 'syncing');

          // 1. Convertir Blob a File
          const file = new File([photo.blob], photo.filename, { type: photo.blob.type });

          // 2. Crear versiones optimizadas
          const optimizedVersions = await createImageVersions(file, [
            { name: 'original', options: { maxWidth: 4000, quality: 0.85, format: 'webp', maxSizeMB: 10 } },
            { name: 'mobile', options: { maxWidth: 1920, quality: 0.85, format: 'webp', maxSizeMB: 10 } },
            { name: 'thumbnail', options: { maxWidth: 400, quality: 0.8, format: 'webp', maxSizeMB: 10 } }
          ]);

          // 3. Subir versión original
          const originalPath = `${photo.tenantId}/${photo.tourId}/${photo.hotspotId}/${Date.now()}.${optimizedVersions.original.format}`;
          const { error: uploadError } = await supabase.storage
            .from('tour-images')
            .upload(originalPath, optimizedVersions.original.blob, {
              contentType: `image/${optimizedVersions.original.format}`,
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // 4. Subir versión móvil
          const mobilePath = `${photo.tenantId}/${photo.tourId}/${photo.hotspotId}/${Date.now()}_mobile.${optimizedVersions.mobile.format}`;
          await supabase.storage
            .from('tour-images')
            .upload(mobilePath, optimizedVersions.mobile.blob, {
              contentType: `image/${optimizedVersions.mobile.format}`,
              upsert: false,
            });

          // 5. Subir thumbnail
          const thumbPath = `${photo.tenantId}/${photo.tourId}/${photo.hotspotId}/${Date.now()}_thumb.${optimizedVersions.thumbnail.format}`;
          await supabase.storage
            .from('tour-images')
            .upload(thumbPath, optimizedVersions.thumbnail.blob, {
              contentType: `image/${optimizedVersions.thumbnail.format}`,
              upsert: false,
            });

          // 6. Obtener URLs públicas
          const { data: { publicUrl: originalUrl } } = supabase.storage
            .from('tour-images')
            .getPublicUrl(originalPath);
          
          const { data: { publicUrl: mobileUrl } } = supabase.storage
            .from('tour-images')
            .getPublicUrl(mobilePath);
          
          const { data: { publicUrl: thumbUrl } } = supabase.storage
            .from('tour-images')
            .getPublicUrl(thumbPath);

          // 7. Obtener el max display_order actual
          const { data: existingPhotos } = await supabase
            .from('panorama_photos')
            .select('display_order')
            .eq('hotspot_id', photo.hotspotId)
            .order('display_order', { ascending: false })
            .limit(1);

          const maxOrder = existingPhotos?.[0]?.display_order ?? -1;

          // 8. Crear registro en DB
          const { error: dbError } = await supabase
            .from('panorama_photos')
            .insert({
              hotspot_id: photo.hotspotId,
              photo_url: originalUrl,
              photo_url_mobile: mobileUrl,
              photo_url_thumbnail: thumbUrl,
              original_filename: photo.filename,
              capture_date: photo.captureDate.toISOString().split('T')[0],
              display_order: maxOrder + 1,
            });

          if (dbError) throw dbError;

          // 9. Actualizar contador de panoramas del hotspot
          const { data: currentHotspot } = await supabase
            .from('hotspots')
            .select('panorama_count')
            .eq('id', photo.hotspotId)
            .single();

          await supabase
            .from('hotspots')
            .update({
              panorama_count: (currentHotspot?.panorama_count || 0) + 1,
              has_panorama: true,
            })
            .eq('id', photo.hotspotId);

          // 10. Marcar como sincronizada y eliminar
          await offlineStorage.updatePhotoStatus(photo.id, 'synced');
          await offlineStorage.deletePhoto(photo.id);

          successCount++;
        } catch (error: any) {
          console.error(`Error sincronizando foto ${photo.id}:`, error);
          await offlineStorage.updatePhotoStatus(
            photo.id,
            'error',
            error.message || 'Error desconocido'
          );
          errorCount++;
        }
      }

      // Mostrar resultado
      if (successCount > 0) {
        toast.success(`✅ ${successCount} foto(s) sincronizada(s)`);
      }
      if (errorCount > 0) {
        toast.error(`❌ ${errorCount} foto(s) fallaron al sincronizar`);
      }

      setStatus(prev => ({
        ...prev,
        lastSyncAt: new Date(),
        pendingCount: errorCount,
      }));

      await loadPendingCount();
    } catch (error: any) {
      console.error('Error en sincronización:', error);
      setStatus(prev => ({ ...prev, error: error.message }));
      toast.error('Error al sincronizar fotos');
    } finally {
      syncInProgressRef.current = false;
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [isOnline, loadPendingCount]);

  // Auto-sync cuando vuelve internet
  useEffect(() => {
    if (isOnline && !syncInProgressRef.current) {
      syncPendingPhotos();
    }
  }, [isOnline, syncPendingPhotos]);

  // Cargar contador inicial
  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  return {
    ...status,
    isOnline,
    syncNow: syncPendingPhotos,
    refreshCount: loadPendingCount,
  };
};
