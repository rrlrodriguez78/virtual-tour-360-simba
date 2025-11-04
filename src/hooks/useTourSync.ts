import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/custom-client';
import { hybridStorage, PendingTour } from '@/utils/hybridStorage';
import { toast } from 'sonner';

export function useTourSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Update pending count
  const updatePendingCount = useCallback(() => {
    const pending = hybridStorage.getPendingTours();
    setPendingCount(pending.length);
  }, []);

  // Upload local image to Supabase Storage
  const uploadLocalImage = async (blobUrl: string, tourId: string): Promise<string> => {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      
      const fileExt = blob.type.split('/')[1] || 'jpg';
      const fileName = `${tourId}/cover-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tour-images')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  // Sync a single pending tour
  const syncSingleTour = async (tour: PendingTour): Promise<boolean> => {
    try {
      // 1. Upload cover image if it's a blob URL
      let coverUrl = tour.coverImageUrl;
      if (coverUrl?.startsWith('blob:')) {
        coverUrl = await uploadLocalImage(coverUrl, tour.id);
      }

      // 2. Insert tour into Supabase
      const { data, error } = await supabase
        .from('virtual_tours')
        .insert({
          title: tour.title,
          description: tour.description,
          cover_image_url: coverUrl,
          tour_type: tour.tourType,
          tenant_id: tour.tenantId
        })
        .select()
        .single();

      if (error) throw error;

      // 3. Mark as synced and save ID mapping
      await hybridStorage.markTourSynced(tour.id, data.id);

      toast.success(`✅ "${tour.title}" sincronizado`);
      return true;
    } catch (error) {
      console.error('Error syncing tour:', error);
      toast.error(`❌ No se pudo sincronizar "${tour.title}"`);
      return false;
    }
  };

  // Sync all pending tours
  const syncPendingTours = useCallback(async () => {
    const pending = hybridStorage.getPendingTours();
    if (pending.length === 0) {
      toast.info('No hay tours pendientes de sincronización');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);

    let syncedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < pending.length; i++) {
      const tour = pending[i];
      const success = await syncSingleTour(tour);
      
      if (success) {
        syncedCount++;
      } else {
        failedCount++;
      }

      setSyncProgress(Math.round(((i + 1) / pending.length) * 100));
    }

    setIsSyncing(false);
    setSyncProgress(0);
    updatePendingCount();

    if (failedCount === 0) {
      toast.success(`🎉 ${syncedCount} tours sincronizados exitosamente`);
    } else {
      toast.warning(`⚠️ ${syncedCount} tours sincronizados, ${failedCount} fallaron`);
    }
  }, [updatePendingCount]);

  // Auto-sync on reconnection
  useEffect(() => {
    const handleOnline = async () => {
      const pending = hybridStorage.getPendingTours();
      if (pending.length > 0) {
        toast.info(`🔄 Sincronizando ${pending.length} tours pendientes...`);
        await syncPendingTours();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncPendingTours]);

  // Initial count
  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  return {
    pendingCount,
    isSyncing,
    syncProgress,
    syncNow: syncPendingTours,
    refreshCount: updatePendingCount
  };
}
