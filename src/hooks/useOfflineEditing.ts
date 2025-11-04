import { useCallback } from 'react';
import { hybridStorage } from '@/utils/hybridStorage';
import { supabase } from '@/integrations/supabase/custom-client';
import { toast } from 'sonner';

export function useOfflineEditing() {
  const markTourAsModified = useCallback(async (tourId: string) => {
    try {
      const tourData = await hybridStorage.loadTour(tourId);
      if (tourData && tourData.metadata) {
        // Update metadata to mark as modified
        const updatedTour = {
          ...tourData,
          metadata: {
            ...tourData.metadata,
            hasLocalChanges: true,
            cachedAt: new Date().toISOString(),
          }
        };
        
        // Save back with updated metadata
        await hybridStorage.saveTour(
          tourId,
          tourData.name,
          tourData.data,
          tourData.floorPlans,
          tourData.hotspots,
          tourData.photos
        );
        
        console.log(`✏️ Tour ${tourId} marked as modified`);
      }
    } catch (error) {
      console.error('Error marking tour as modified:', error);
    }
  }, []);

  const uploadLocalChanges = useCallback(async (tourId: string) => {
    try {
      const tourData = await hybridStorage.loadTour(tourId);
      if (!tourData || !tourData.metadata?.hasLocalChanges) {
        return false;
      }

      toast.info('⬆️ Subiendo cambios locales...');

      // Upload tour metadata
      const { error: tourError } = await supabase
        .from('virtual_tours')
        .update({
          title: tourData.data.title,
          description: tourData.data.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tourId);

      if (tourError) throw tourError;

      // Upload floor plans if modified
      if (tourData.floorPlans) {
        for (const floorPlan of tourData.floorPlans) {
          const { error: fpError } = await supabase
            .from('floor_plans')
            .upsert({
              id: floorPlan.id,
              tour_id: tourId,
              tenant_id: floorPlan.tenant_id,
              name: floorPlan.name,
              image_url: floorPlan.image_url,
              width: floorPlan.width,
              height: floorPlan.height,
              capture_date: floorPlan.capture_date,
            });

          if (fpError) throw fpError;
        }
      }

      // Upload hotspots if modified
      if (tourData.hotspots) {
        for (const hotspot of tourData.hotspots) {
          const { error: hsError } = await supabase
            .from('hotspots')
            .upsert({
              id: hotspot.id,
              floor_plan_id: hotspot.floor_plan_id,
              title: hotspot.title,
              description: hotspot.description,
              x_position: hotspot.x_position,
              y_position: hotspot.y_position,
              media_type: hotspot.media_type,
              media_url: hotspot.media_url,
            });

          if (hsError) throw hsError;
        }
      }

      // Mark as synced by saving again with updated metadata
      const syncedTour = {
        ...tourData,
        metadata: {
          ...tourData.metadata,
          hasLocalChanges: false,
          lastSyncedAt: new Date().toISOString(),
        }
      };

      await hybridStorage.saveTour(
        tourId,
        tourData.name,
        syncedTour.data,
        syncedTour.floorPlans,
        syncedTour.hotspots,
        syncedTour.photos
      );

      toast.success('✅ Cambios locales sincronizados');
      return true;
    } catch (error) {
      console.error('Error uploading local changes:', error);
      toast.error('Error al sincronizar cambios');
      return false;
    }
  }, []);

  return {
    markTourAsModified,
    uploadLocalChanges,
  };
}
