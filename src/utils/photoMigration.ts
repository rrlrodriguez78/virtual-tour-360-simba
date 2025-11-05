/**
 * Utility functions to migrate old panorama photos to new optimized format
 */

import { supabase } from '@/integrations/supabase/client';
import { createImageVersions } from './imageOptimization';

interface MigrationResult {
  photoId: string;
  success: boolean;
  error?: string;
  originalUrl: string;
  newUrls?: {
    original: string;
    mobile: string;
    thumbnail: string;
  };
}

/**
 * Check if a photo needs migration (all URLs are the same = old format)
 */
export const needsMigration = (photo: any): boolean => {
  return (
    photo.photo_url === photo.photo_url_mobile &&
    photo.photo_url === photo.photo_url_thumbnail
  );
};

/**
 * Download image from URL as blob
 */
const downloadImageAsBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  
  return response.blob();
};

/**
 * Migrate a single photo to new format with optimized versions
 */
export const migratePhoto = async (photo: any): Promise<MigrationResult> => {
  console.log(`🔄 Migrating photo ${photo.id}...`);
  
  try {
    // 1. Download original image
    console.log(`📥 Downloading from: ${photo.photo_url}`);
    const originalBlob = await downloadImageAsBlob(photo.photo_url);
    const originalFile = new File([originalBlob], 'panorama.jpg', {
      type: originalBlob.type
    });
    
    // 2. Create optimized versions
    console.log(`🔧 Creating optimized versions...`);
    const versions = await createImageVersions(originalFile, [
      { name: 'original', options: { maxWidth: 3000, quality: 0.75, format: 'webp', maxSizeMB: 10 } },
      { name: 'mobile', options: { maxWidth: 1280, quality: 0.75, format: 'webp', maxSizeMB: 10 } },
      { name: 'thumbnail', options: { maxWidth: 400, quality: 0.7, format: 'webp', maxSizeMB: 10 } }
    ]);
    
    // 3. Upload to storage with new naming convention
    const timestamp = Date.now();
    const hotspotId = photo.hotspot_id;
    const baseFileName = `${hotspotId}/${timestamp}_migrated`;
    
    console.log(`☁️ Uploading optimized versions...`);
    
    // Upload original
    const { error: uploadError1 } = await supabase.storage
      .from('tour-images')
      .upload(`${baseFileName}.${versions.original.format}`, versions.original.blob);
    
    if (uploadError1) throw uploadError1;
    
    // Upload mobile
    const { error: uploadError2 } = await supabase.storage
      .from('tour-images')
      .upload(`${baseFileName}_mobile.${versions.mobile.format}`, versions.mobile.blob);
    
    if (uploadError2) throw uploadError2;
    
    // Upload thumbnail
    const { error: uploadError3 } = await supabase.storage
      .from('tour-images')
      .upload(`${baseFileName}_thumb.${versions.thumbnail.format}`, versions.thumbnail.blob);
    
    if (uploadError3) throw uploadError3;
    
    // 4. Get public URLs
    const { data: { publicUrl: originalUrl } } = supabase.storage
      .from('tour-images')
      .getPublicUrl(`${baseFileName}.${versions.original.format}`);
    
    const { data: { publicUrl: mobileUrl } } = supabase.storage
      .from('tour-images')
      .getPublicUrl(`${baseFileName}_mobile.${versions.mobile.format}`);
    
    const { data: { publicUrl: thumbnailUrl } } = supabase.storage
      .from('tour-images')
      .getPublicUrl(`${baseFileName}_thumb.${versions.thumbnail.format}`);
    
    // 5. Update database record
    console.log(`💾 Updating database record...`);
    const { error: updateError } = await supabase
      .from('panorama_photos')
      .update({
        photo_url: originalUrl,
        photo_url_mobile: mobileUrl,
        photo_url_thumbnail: thumbnailUrl
      })
      .eq('id', photo.id);
    
    if (updateError) throw updateError;
    
    console.log(`✅ Migration successful for photo ${photo.id}`);
    
    return {
      photoId: photo.id,
      success: true,
      originalUrl: photo.photo_url,
      newUrls: {
        original: originalUrl,
        mobile: mobileUrl,
        thumbnail: thumbnailUrl
      }
    };
    
  } catch (error: any) {
    console.error(`❌ Migration failed for photo ${photo.id}:`, error);
    return {
      photoId: photo.id,
      success: false,
      error: error.message,
      originalUrl: photo.photo_url
    };
  }
};

/**
 * Migrate all photos that need migration
 */
export const migrateAllPhotos = async (): Promise<MigrationResult[]> => {
  console.log('🚀 Starting photo migration...');
  
  // 1. Get all photos
  const { data: photos, error } = await supabase
    .from('panorama_photos')
    .select('*');
  
  if (error) {
    console.error('Error fetching photos:', error);
    throw error;
  }
  
  // 2. Filter photos that need migration
  const photosToMigrate = photos.filter(needsMigration);
  
  console.log(`📊 Found ${photosToMigrate.length} photos that need migration out of ${photos.length} total`);
  
  if (photosToMigrate.length === 0) {
    console.log('✨ All photos are already optimized!');
    return [];
  }
  
  // 3. Migrate photos one by one
  const results: MigrationResult[] = [];
  
  for (const photo of photosToMigrate) {
    const result = await migratePhoto(photo);
    results.push(result);
    
    // Wait a bit between migrations to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  console.log(`✅ Migration complete: ${successCount} successful, ${failureCount} failed`);
  
  return results;
};
