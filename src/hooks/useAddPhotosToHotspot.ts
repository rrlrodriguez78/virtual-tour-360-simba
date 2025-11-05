import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AddPhotosParams {
  hotspotId: string;
  photos: Array<{
    file: File;
    optimizedBlob?: Blob;
    captureDate: string | null;
    groupName: string;
  }>;
  tourId: string;
  floorPlanId: string;
  hotspotTitle: string;
  tenantId?: string; // Optional: for Google Drive sync
}

export const useAddPhotosToHotspot = () => {
  const [isAdding, setIsAdding] = useState(false);

  const addPhotos = async (params: AddPhotosParams) => {
    setIsAdding(true);
    
    try {
      // 1. Obtener el display_order máximo actual
      const { data: existingPhotos } = await supabase
        .from('panorama_photos')
        .select('display_order')
        .eq('hotspot_id', params.hotspotId)
        .order('display_order', { ascending: false })
        .limit(1);
      
      const startOrder = existingPhotos?.[0]?.display_order ?? -1;
      
      // 2. Ordenar fotos por fecha
      const sortedPhotos = [...params.photos].sort((a, b) => {
        if (!a.captureDate) return 1;
        if (!b.captureDate) return -1;
        return a.captureDate.localeCompare(b.captureDate);
      });

      // 3. Subir y crear registros - parallelizar uploads
      const uploadPromises = sortedPhotos.map(async (photoData, i) => {
        const timestamp = Date.now() + i;
        const safeFileName = photoData.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const baseFileName = `panoramas/${params.hotspotId}/${timestamp}_${safeFileName}`;

        // Use pre-optimized blob if available
        const blobToUpload = photoData.optimizedBlob || photoData.file;
        const extension = blobToUpload instanceof Blob && blobToUpload.type === 'image/webp' ? 'webp' : 'jpg';

        // Upload single optimized version (already compressed to target size)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('tour-images')
          .upload(`${baseFileName}.${extension}`, blobToUpload);
        
        if (uploadError) {
          console.error('Error uploading photo:', uploadError);
          return null;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(uploadData.path);

        // Create panorama_photo record
        const finalCaptureDate = photoData.captureDate || new Date().toISOString().split('T')[0];
        
        const { data: newPhoto, error: panoramaError } = await supabase
          .from('panorama_photos')
          .insert({
            hotspot_id: params.hotspotId,
            photo_url: publicUrl,
            photo_url_mobile: publicUrl, // Same optimized version for mobile
            photo_url_thumbnail: publicUrl, // Same optimized version for thumbnail
            display_order: startOrder + i + 1,
            original_filename: photoData.file.name,
            capture_date: finalCaptureDate,
            description: `${photoData.groupName} - ${params.hotspotTitle}`,
          })
          .select()
          .single();

        if (panoramaError) {
          console.error('Error creating panorama record:', panoramaError);
          return null;
        }

        // Sync to Google Drive (non-blocking)
        if (params.tenantId && newPhoto) {
          supabase.functions
            .invoke('photo-sync-to-drive', {
              body: {
                action: 'sync_photo',
                photoId: newPhoto.id,
                tenantId: params.tenantId
              }
            })
            .then(({ data, error: syncError }) => {
              if (syncError) {
                console.warn('⚠️ Photo sync to Drive failed:', syncError);
              } else {
                console.log('✅ Photo synced to Drive:', data);
              }
            })
            .catch(err => console.warn('⚠️ Photo sync error:', err));
        }

        return photoData.file.name;
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r !== null).length;
      
      // 4. Actualizar contador de panoramas en el hotspot
      const { data: totalPhotos } = await supabase
        .from('panorama_photos')
        .select('id', { count: 'exact' })
        .eq('hotspot_id', params.hotspotId);
      
      await supabase
        .from('hotspots')
        .update({
          has_panorama: true,
          panorama_count: totalPhotos?.length || 0
        })
        .eq('id', params.hotspotId);
      
      return { success: true, photosAdded: successCount };
    } catch (error) {
      console.error('Error adding photos:', error);
      throw error;
    } finally {
      setIsAdding(false);
    }
  };
  
  return {
    addPhotos,
    isAdding
  };
};