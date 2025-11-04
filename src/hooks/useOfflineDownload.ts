import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/custom-client';
import { hybridStorage } from '@/utils/hybridStorage';
import { isNativeApp, checkStoragePermission, requestStoragePermission } from '@/utils/storagePermissions';
import { toast } from 'sonner';
import type { Tour, FloorPlan, Hotspot } from '@/types/tour';

interface DownloadProgress {
  tourId: string;
  tourName: string;
  stage: 'metadata' | 'floorplans' | 'photos' | 'complete';
  progress: number; // 0-100
  currentItem: string;
  totalItems: number;
  currentItemNumber: number;
}

export function useOfflineDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // Compress image blob with optimized settings for panoramas
  const compressImage = async (blob: Blob, isPanorama = false): Promise<Blob> => {
    const minSize = isPanorama ? 800000 : 500000; // Higher threshold for panoramas
    if (blob.size < minSize) return blob;

    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      img.onload = () => {
        // Use higher resolution for panoramas to maintain quality
        const maxSize = isPanorama ? 2048 : 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressedBlob) => {
            resolve(compressedBlob || blob);
          },
          'image/jpeg',
          isPanorama ? 0.85 : 0.80 // Higher quality for panoramas
        );
      };

      img.src = URL.createObjectURL(blob);
    });
  };

  // Download floor plan image
  const downloadFloorPlanImage = async (url: string, isPanorama = false): Promise<string> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download image');
      
      const blob = await response.blob();
      const compressedBlob = await compressImage(blob, isPanorama);
      
      // Convert to base64 for storage
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  };

  // Download all panorama photos for a hotspot (CORRECTED)
  const downloadHotspotPhotos = async (hotspotId: string): Promise<any[]> => {
    try {
      const { data: photos, error } = await supabase
        .from('panorama_photos')
        .select('*')
        .eq('hotspot_id', hotspotId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      if (!photos || photos.length === 0) return [];

      const downloadedPhotos: any[] = [];

      for (const photo of photos) {
        if (photo.photo_url) {
          const base64Image = await downloadFloorPlanImage(photo.photo_url);
          downloadedPhotos.push({
            ...photo,
            photo_url: base64Image,
            // Keep metadata for offline use
            capture_date: photo.capture_date,
            display_order: photo.display_order,
            description: photo.description
          });
        }
      }

      return downloadedPhotos;
    } catch (error) {
      console.error('Error downloading panorama photos:', error);
      return [];
    }
  };

  // Download navigation arrows for a hotspot
  const downloadNavigationArrows = async (hotspotId: string): Promise<any[]> => {
    try {
      const { data: arrows, error } = await supabase
        .from('hotspot_navigation_points')
        .select('*')
        .eq('from_hotspot_id', hotspotId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return arrows || [];
    } catch (error) {
      console.error('Error downloading navigation arrows:', error);
      return [];
    }
  };

  // Main download function
  const downloadTourForOffline = useCallback(async (tourId: string, tourName: string) => {
    setIsDownloading(true);
    setDownloadProgress({
      tourId,
      tourName,
      stage: 'metadata',
      progress: 0,
      currentItem: 'Verificando permisos...',
      totalItems: 1,
      currentItemNumber: 0
    });

    try {
      // 🆕 FASE 1: Verificar y solicitar permisos ANTES de descargar
      const isNative = isNativeApp();
      console.log(`📱 [OfflineDownload] Starting download for: ${tourName} (${tourId})`);
      console.log(`🔍 [OfflineDownload] Is native app: ${isNative}`);
      
      if (isNative) {
        console.log('📱 [OfflineDownload] Native app detected - checking storage permissions...');
        const permissionStatus = await checkStoragePermission();
        console.log('📋 [OfflineDownload] Current permission status:', permissionStatus);
        
        if (!permissionStatus.granted) {
          console.log('⚠️ [OfflineDownload] No permissions, requesting...');
          toast.info('La app necesita permisos de almacenamiento para guardar offline');
          const granted = await requestStoragePermission();
          
          if (!granted) {
            console.error('❌ [OfflineDownload] Permission denied by user');
            toast.error('Sin permisos de almacenamiento. Ve a Ajustes > Aplicaciones > VirtualTour360 > Permisos');
            throw new Error('Storage permission denied');
          }
          
          console.log('✅ [OfflineDownload] Permissions granted, reinitializing storage...');
          // 🆕 FASE 2: Reinicializar storage adapter para usar Filesystem
          await hybridStorage.reinitialize();
          toast.success('✅ Permisos concedidos. Iniciando descarga...');
        } else {
          console.log('✅ [OfflineDownload] Permissions already granted');
        }
      }

      setDownloadProgress({
        tourId,
        tourName,
        stage: 'metadata',
        progress: 5,
        currentItem: 'Cargando información del tour...',
        totalItems: 1,
        currentItemNumber: 0
      });

      // 1. Download tour metadata
      const { data: tour, error: tourError } = await supabase
        .from('virtual_tours')
        .select('*')
        .eq('id', tourId)
        .single();

      if (tourError) throw tourError;

      setDownloadProgress(prev => prev ? {
        ...prev,
        progress: 10,
        stage: 'floorplans',
        currentItem: 'Descargando planos...'
      } : null);

      // 2. Download floor plans
      const { data: floorPlans, error: plansError } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: true });

      if (plansError) throw plansError;

      const totalFloorPlans = floorPlans?.length || 0;
      const floorPlansWithImages: any[] = [];

      for (let i = 0; i < totalFloorPlans; i++) {
        const plan = floorPlans![i];
        
        setDownloadProgress(prev => prev ? {
          ...prev,
          progress: 10 + (30 * (i / totalFloorPlans)),
          currentItem: `Descargando plano: ${plan.name}`,
          totalItems: totalFloorPlans,
          currentItemNumber: i + 1
        } : null);

        let imageData = plan.image_url;
        if (plan.image_url) {
          imageData = await downloadFloorPlanImage(plan.image_url);
        }

        floorPlansWithImages.push({
          ...plan,
          image_data: imageData
        });
      }

      setDownloadProgress(prev => prev ? {
        ...prev,
        progress: 40,
        stage: 'photos',
        currentItem: 'Descargando puntos de navegación...'
      } : null);

      // 3. Download hotspots
      const { data: hotspots, error: hotspotsError } = await supabase
        .from('hotspots')
        .select('*')
        .in('floor_plan_id', floorPlansWithImages.map(p => p.id))
        .order('created_at', { ascending: true });

      if (hotspotsError) throw hotspotsError;

      const totalHotspots = hotspots?.length || 0;
      const hotspotsWithPhotos: any[] = [];

      // Count total photos to download
      let totalPhotos = 0;
      let downloadedPhotos = 0;

      for (const hotspot of hotspots || []) {
        const { data: photoCount } = await supabase
          .from('panorama_photos')
          .select('id', { count: 'exact', head: true })
          .eq('hotspot_id', hotspot.id);
        totalPhotos += photoCount?.length || 0;
      }

      for (let i = 0; i < totalHotspots; i++) {
        const hotspot = hotspots![i];
        
        // Download all panorama photos
        const { data: photosData } = await supabase
          .from('panorama_photos')
          .select('*')
          .eq('hotspot_id', hotspot.id)
          .order('display_order', { ascending: true });

        const photos: any[] = [];
        const hotspotPhotoCount = photosData?.length || 0;

        for (let j = 0; j < hotspotPhotoCount; j++) {
          const photo = photosData![j];
          downloadedPhotos++;
          
          setDownloadProgress(prev => prev ? {
            ...prev,
            progress: 40 + (50 * (downloadedPhotos / totalPhotos)),
            currentItem: `Descargando foto ${downloadedPhotos}/${totalPhotos} - ${hotspot.title}`,
            totalItems: totalPhotos,
            currentItemNumber: downloadedPhotos
          } : null);

          if (photo.photo_url) {
            const base64Image = await downloadFloorPlanImage(photo.photo_url, true); // Mark as panorama
            photos.push({
              ...photo,
              photo_url: base64Image
            });
          }
        }

        // Download navigation arrows
        const navigationArrows = await downloadNavigationArrows(hotspot.id);

        hotspotsWithPhotos.push({
          ...hotspot,
          photos,
          navigation_points: navigationArrows
        });
      }

      setDownloadProgress(prev => prev ? {
        ...prev,
        progress: 95,
        currentItem: 'Guardando en almacenamiento local...'
      } : null);

      // 4. Save to hybrid storage
      await hybridStorage.saveTour(
        tourId,
        tourName,
        tour as Tour,
        floorPlansWithImages,
        hotspotsWithPhotos,
        []
      );

      setDownloadProgress(prev => prev ? {
        ...prev,
        progress: 95,
        currentItem: 'Verificando integridad...'
      } : null);

      // 5. Verify integrity
      const integrity = await verifyTourIntegrity(tourId);
      
      if (!integrity.valid) {
        throw new Error(`Tour incompleto: ${integrity.reason}`);
      }

      setDownloadProgress(prev => prev ? {
        ...prev,
        progress: 100,
        stage: 'complete',
        currentItem: '¡Descarga completa!'
      } : null);

      toast.success(`✅ "${tourName}" descargado para uso offline`, {
        description: `${integrity.totalPhotos} fotos • ${integrity.totalFloorPlans} planos`
      });

      // Reset after 2 seconds
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(null);
      }, 2000);

    } catch (error) {
      console.error('Error downloading tour:', error);
      toast.error('Error al descargar tour para offline');
      setIsDownloading(false);
      setDownloadProgress(null);
      throw error;
    }
  }, []);

  // Check if tour is already downloaded
  const isTourDownloaded = useCallback(async (tourId: string): Promise<boolean> => {
    try {
      const cached = await hybridStorage.loadTour(tourId);
      return !!cached;
    } catch {
      return false;
    }
  }, []);

  // Verify tour integrity after download
  const verifyTourIntegrity = useCallback(async (tourId: string): Promise<{
    valid: boolean;
    reason?: string;
    totalPhotos?: number;
    totalFloorPlans?: number;
  }> => {
    try {
      const cached = await hybridStorage.loadTour(tourId);
      if (!cached) return { valid: false, reason: 'Tour no encontrado en cache' };

      // Verificar que tenga floor plans
      if (!cached.floorPlans || cached.floorPlans.length === 0) {
        return { valid: false, reason: 'No hay planos descargados' };
      }

      // Verificar que tenga hotspots con fotos
      let totalPhotos = 0;
      for (const hotspot of cached.hotspots) {
        if ((hotspot as any).photos) {
          totalPhotos += (hotspot as any).photos.length;
        }
      }

      if (totalPhotos === 0) {
        return { 
          valid: false, 
          reason: 'No hay fotos descargadas',
          totalFloorPlans: cached.floorPlans.length
        };
      }

      return { 
        valid: true, 
        totalPhotos,
        totalFloorPlans: cached.floorPlans.length
      };
    } catch (error) {
      console.error('Error verifying tour integrity:', error);
      return { valid: false, reason: 'Error al verificar integridad' };
    }
  }, []);

  // Delete downloaded tour
  const deleteTourOffline = useCallback(async (tourId: string, tourName: string) => {
    try {
      await hybridStorage.deleteTour(tourId);
      toast.success(`"${tourName}" eliminado del almacenamiento offline`);
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error('Error al eliminar tour offline');
      throw error;
    }
  }, []);

  return {
    isDownloading,
    downloadProgress,
    downloadTourForOffline,
    isTourDownloaded,
    deleteTourOffline,
    verifyTourIntegrity
  };
}
