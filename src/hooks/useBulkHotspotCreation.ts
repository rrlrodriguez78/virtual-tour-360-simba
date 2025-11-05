import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CreateHotspotParams {
  name: string;
  photos: Array<{
    file: File;
    optimizedBlob?: Blob;
    captureDate: string | null;
  }>;
  position: { x: number; y: number };
  displayOrder: number;
}

export const useBulkHotspotCreation = (floorPlanId: string, tourId: string) => {
  const [isCreating, setIsCreating] = useState(false);

  const createHotspot = async (params: CreateHotspotParams) => {
    setIsCreating(true);
    
    try {
      // 1. Check if hotspot already exists
      const { data: existing, error: checkError } = await supabase
        .from('hotspots')
        .select('id, panorama_count')
        .eq('floor_plan_id', floorPlanId)
        .eq('title', params.name)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      let hotspot;
      
      if (existing) {
        // Hotspot exists, we'll add photos to it
        hotspot = existing;
      } else {
        // Create new hotspot
        const { data: newHotspot, error: hotspotError } = await supabase
          .from('hotspots')
          .insert({
            floor_plan_id: floorPlanId,
            title: params.name,
            x_position: params.position.x,
            y_position: params.position.y,
            display_order: params.displayOrder,
            has_panorama: params.photos.length > 0,
            panorama_count: params.photos.length
          })
          .select()
          .single();
        
        if (hotspotError) throw hotspotError;
        hotspot = newHotspot;
      }

      // 2. Ordenar fotos por fecha antes de subir
      const sortedPhotos = [...params.photos].sort((a, b) => {
        if (!a.captureDate) return 1;
        if (!b.captureDate) return -1;
        return a.captureDate.localeCompare(b.captureDate);
      });

      // 3. Get current photo count for proper ordering
      const startOrder = existing ? existing.panorama_count : 0;

      // 4. Subir todas las fotos de este hotspot - parallelizar uploads
      const uploadPromises = sortedPhotos.map(async (photoData, i) => {
        const timestamp = Date.now() + i;
        const safeFileName = photoData.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const baseFileName = `panoramas/${hotspot.id}/${timestamp}_${safeFileName}`;

        // Use pre-optimized blob if available
        const blobToUpload = photoData.optimizedBlob || photoData.file;
        const extension = blobToUpload instanceof Blob && blobToUpload.type === 'image/webp' ? 'webp' : 'jpg';

        // Upload single optimized version
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
        
        const { error: panoramaError } = await supabase
          .from('panorama_photos')
          .insert({
            hotspot_id: hotspot.id,
            photo_url: publicUrl,
            photo_url_mobile: publicUrl,
            photo_url_thumbnail: publicUrl,
            display_order: startOrder + i,
            original_filename: photoData.file.name,
            capture_date: finalCaptureDate,
            description: `Panoramic photo of ${params.name}`,
          });

        if (panoramaError) {
          console.error('Error creating panorama record:', panoramaError);
          return null;
        }

        return photoData.file.name;
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r !== null).length;
      
      // 5. Update hotspot panorama count
      const { error: updateError } = await supabase
        .from('hotspots')
        .update({
          panorama_count: startOrder + successCount,
          has_panorama: successCount > 0
        })
        .eq('id', hotspot.id);
      
      if (updateError) throw updateError;
      
      return hotspot;
    } finally {
      setIsCreating(false);
    }
  };
  
  return {
    createHotspot,
    isCreating
  };
};
