import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Upload, Trash2, GripVertical, Eye, Calendar as CalendarIcon, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThetaCameraConnector } from './ThetaCameraConnector';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useTenant } from '@/contexts/TenantContext';
import { 
  createImageVersions, 
  validateImageFile, 
  formatFileSize, 
  getCompressionStats 
} from '@/utils/imageOptimization';

interface PanoramaPhoto {
  id: string;
  hotspot_id: string;
  photo_url: string;
  photo_url_mobile?: string;
  photo_url_thumbnail?: string;
  description?: string;
  display_order: number;
  capture_date?: string;
}

interface PanoramaManagerProps {
  hotspotId: string;
  tourId?: string;
}

interface TourInfo {
  tourId: string;
  tenantId: string;
}

const imageVersions = {
  original: {
    maxWidth: 4000,
    quality: 0.80,
    format: 'webp'
  },
  mobile: {
    maxWidth: 2400,
    quality: 0.75,
    format: 'webp'
  },
  thumbnail: {
    maxWidth: 400,
    quality: 0.60,
    format: 'webp'
  }
};

const previewSize = 1000; // Preview rápido

export default function PanoramaManager({ hotspotId, tourId }: PanoramaManagerProps) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<PanoramaPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tourInfo, setTourInfo] = useState<TourInfo | null>(null);
  const [photoSubTab, setPhotoSubTab] = useState<'upload' | 'theta'>('upload');
  const { currentTenant } = useTenant();
  const { pendingCount, isSyncing, isOnline, syncNow } = useOfflineSync(hotspotId);
  
  // Recuperar la última fecha usada de localStorage, o usar hoy por defecto
  const [uploadDate, setUploadDate] = useState<Date>(() => {
    const lastUsedDate = localStorage.getItem('lastUploadDate');
    return lastUsedDate ? parseISO(lastUsedDate) : new Date();
  });
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    finalSize: number;
    reduction: number;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    progress: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    loadPhotos();
    loadTourInfo();
  }, [hotspotId]);

  const loadTourInfo = async () => {
    try {
      // Get tour_id and tenant_id from hotspot
      const { data: hotspot, error: hotspotError } = await supabase
        .from('hotspots')
        .select('floor_plan_id')
        .eq('id', hotspotId)
        .single();

      if (hotspotError) throw hotspotError;

      const { data: floorPlan, error: floorError } = await supabase
        .from('floor_plans')
        .select('tour_id')
        .eq('id', hotspot.floor_plan_id)
        .single();

      if (floorError) throw floorError;

      const { data: tour, error: tourError } = await supabase
        .from('virtual_tours')
        .select('id, tenant_id')
        .eq('id', floorPlan.tour_id)
        .single();

      if (tourError) throw tourError;

      setTourInfo({
        tourId: tour.id,
        tenantId: tour.tenant_id
      });

      console.log('🔄 Tour info loaded for sync:', { tourId: tour.id, tenantId: tour.tenant_id });
    } catch (error) {
      console.error('Error loading tour info:', error);
    }
  };

  const loadPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('panorama_photos')
        .select('*')
        .eq('hotspot_id', hotspotId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error loading panorama photos:', error);
      toast.error(t('panorama.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const createThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > previewSize || height > previewSize) {
          const ratio = Math.min(previewSize / width, previewSize / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve('');
          }
        }, 'image/webp', 0.8);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const optimizeImage = async (
    file: File, 
    maxWidth: number, 
    quality: number, 
    format: string
  ): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Calcular nuevo tamaño manteniendo ratio
        if (width > maxWidth || height > maxWidth) {
          const ratio = Math.min(maxWidth / width, maxWidth / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const optimizedFile = new File([blob], file.name, {
              type: `image/${format}`,
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          } else {
            resolve(file);
          }
        }, `image/${format}`, quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  // Helper function to upload with retry logic
  const uploadWithRetry = async (
    bucket: string, 
    path: string, 
    blob: Blob, 
    maxRetries = 3
  ): Promise<any> => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await supabase.storage.from(bucket).upload(path, blob);
        if (result.error) throw result.error;
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Retry only on 502 errors
        if (error.message?.includes('502') || error.statusCode === 502) {
          console.warn(`⚠️ Upload attempt ${attempt}/${maxRetries} failed with 502, retrying...`);
          
          if (attempt < maxRetries) {
            // Wait 2 seconds before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || t('panorama.onlyImages'));
      return;
    }

    const originalSize = file.size;
    setUploading(true);
    setUploadProgress({ progress: 10, status: t('panorama.creatingPreview') });
    
    try {
      setUploadProgress({ progress: 30, status: t('panorama.optimizing') });
      
      const timestamp = Date.now();
      const baseFileName = `${hotspotId}/${timestamp}`;
      
      // Create optimized versions with REDUCED sizes to avoid 502
      const versions = await createImageVersions(file, [
        { name: 'original', options: { maxWidth: 3000, quality: 0.75, format: 'webp', maxSizeMB: 10 } },
        { name: 'mobile', options: { maxWidth: 1280, quality: 0.75, format: 'webp', maxSizeMB: 10 } },
        { name: 'thumbnail', options: { maxWidth: 400, quality: 0.7, format: 'webp', maxSizeMB: 10 } }
      ]);
      
      // Calculate compression stats
      const stats = getCompressionStats(originalSize, versions.original.optimizedSize);
      setCompressionStats({
        originalSize,
        finalSize: versions.original.optimizedSize,
        reduction: stats.savingsPercent
      });
      
      setUploadProgress({ progress: 60, status: t('panorama.optimized') });
      
      toast.success(
        `${t('panorama.optimized')}: ${formatFileSize(originalSize)} → ${formatFileSize(versions.original.optimizedSize)} (-${stats.savingsPercent}%)`,
        { duration: 5000 }
      );

      // Upload SEQUENTIALLY with retry logic to avoid 502
      setUploadProgress({ progress: 70, status: t('panorama.uploading') });
      
      console.log('🔄 Starting sequential upload with retry...');
      
      const originalUpload = await uploadWithRetry(
        'tour-images',
        `${baseFileName}.${versions.original.format}`,
        versions.original.blob
      );
      console.log('✅ Original uploaded');
      
      setUploadProgress({ progress: 80, status: t('panorama.uploading') });
      
      const mobileUpload = await uploadWithRetry(
        'tour-images',
        `${baseFileName}_mobile.${versions.mobile.format}`,
        versions.mobile.blob
      );
      console.log('✅ Mobile uploaded');
      
      setUploadProgress({ progress: 85, status: t('panorama.uploading') });
      
      const thumbnailUpload = await uploadWithRetry(
        'tour-images',
        `${baseFileName}_thumb.${versions.thumbnail.format}`,
        versions.thumbnail.blob
      );
      console.log('✅ Thumbnail uploaded');
      
      setUploadProgress({ progress: 90, status: t('panorama.finalizing') });

      // Get public URLs for all versions
      const { data: { publicUrl: originalUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(`${baseFileName}.${versions.original.format}`);
      
      const { data: { publicUrl: mobileUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(`${baseFileName}_mobile.${versions.mobile.format}`);
      
      const { data: { publicUrl: thumbnailUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(`${baseFileName}_thumb.${versions.thumbnail.format}`);

      // Save to database with all 3 URLs and original filename
      const { data: insertedPhoto, error: dbError } = await supabase
        .from('panorama_photos')
        .insert({
          hotspot_id: hotspotId,
          photo_url: originalUrl,
          photo_url_mobile: mobileUrl,
          photo_url_thumbnail: thumbnailUrl,
          display_order: photos.length,
          capture_date: format(uploadDate, 'yyyy-MM-dd'),
          original_filename: file.name,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadProgress({ progress: 100, status: t('panorama.complete') });
      toast.success(t('panorama.uploadSuccess'));
      
      localStorage.setItem('lastUploadDate', format(uploadDate, 'yyyy-MM-dd'));
      
      // Sync to Google Drive (non-blocking)
      if (insertedPhoto && tourInfo) {
        console.log('🔄 Attempting to sync photo to Google Drive...', {
          photoId: insertedPhoto.id,
          tourId: tourInfo.tourId,
          tenantId: tourInfo.tenantId
        });

        supabase.functions
          .invoke('photo-sync-to-drive', {
            body: { 
              action: 'sync_photo',
              photoId: insertedPhoto.id,
              tourId: tourInfo.tourId,
              tenantId: tourInfo.tenantId
            }
          })
          .then(({ data, error }) => {
            if (error) {
              console.warn('⚠️ Photo sync to Drive failed:', error);
            } else {
              console.log('✅ Photo synced to Drive:', data);
              toast.success('Photo synced to Google Drive!');
            }
          })
          .catch(err => {
            console.warn('⚠️ Photo sync to Drive failed:', err);
          });
      } else {
        console.warn('⚠️ Cannot sync to Drive: missing tourInfo or insertedPhoto');
      }
      
      loadPhotos();
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error(error.message || t('panorama.errorUploading'));
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleDelete = async (photo: PanoramaPhoto) => {
    if (!confirm(t('panorama.deleteConfirm'))) return;

    try {
      // Delete from storage
      const fileName = photo.photo_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('tour-images')
          .remove([`${hotspotId}/${fileName}`]);
      }

      // Delete from database
      const { error } = await supabase
        .from('panorama_photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      toast.success(t('panorama.deleted'));
      loadPhotos();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error(t('panorama.errorDeleting'));
    }
  };

  const updateCaptureDate = async (photoId: string, newDate: Date) => {
    try {
      const { error } = await supabase
        .from('panorama_photos')
        .update({ capture_date: format(newDate, 'yyyy-MM-dd') })
        .eq('id', photoId);

      if (error) throw error;
      
      toast.success(t('panorama.dateUpdated'));
      loadPhotos();
    } catch (error) {
      console.error('Error updating capture date:', error);
      toast.error(t('panorama.errorUpdatingDate'));
    }
  };

  const updateOrder = async (photoId: string, newOrder: number) => {
    try {
      const { error } = await supabase
        .from('panorama_photos')
        .update({ display_order: newOrder })
        .eq('id', photoId);

      if (error) throw error;
      loadPhotos();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Error al actualizar orden');
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPhotos = [...photos];
    [newPhotos[index - 1], newPhotos[index]] = [newPhotos[index], newPhotos[index - 1]];
    newPhotos.forEach((photo, i) => updateOrder(photo.id, i));
  };

  const moveDown = (index: number) => {
    if (index === photos.length - 1) return;
    const newPhotos = [...photos];
    [newPhotos[index], newPhotos[index + 1]] = [newPhotos[index + 1], newPhotos[index]];
    newPhotos.forEach((photo, i) => updateOrder(photo.id, i));
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={photoSubTab} onValueChange={(v) => setPhotoSubTab(v as 'upload' | 'theta')}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="w-4 h-4" />
            Subir Fotos
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="theta" className="gap-2">
            <Camera className="w-4 h-4" />
            Theta Z1
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div className="space-y-2">
            <Label>{t('panorama.upload')}</Label>
        
        {/* Selector de fecha antes de subir */}
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-sm">{t('panorama.captureDate')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(uploadDate, 'PPP', { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={uploadDate}
                onSelect={(date) => {
                  if (date) {
                    setUploadDate(date);
                    // Guardar inmediatamente al cambiar la fecha
                    localStorage.setItem('lastUploadDate', format(date, 'yyyy-MM-dd'));
                  }
                }}
                locale={es}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
          <label htmlFor="panorama-upload" className="cursor-pointer">
            <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-1">
              {t('panorama.clickToUpload')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('panorama.maxSize')}
            </p>
            <input
              id="panorama-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{uploadProgress.status}</span>
              <span className="text-muted-foreground">{Math.round(uploadProgress.progress)}%</span>
            </div>
            <Progress value={uploadProgress.progress} className="h-2" />
          </div>
        )}

        {photos.length > 0 && (
          <div className="space-y-2">
            <Label>{t('panorama.photos')} ({photos.length})</Label>
            <div className="space-y-2">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="flex items-center gap-2 p-2 bg-muted rounded-lg"
              >
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                  >
                    <GripVertical className="w-4 h-4" />
                  </Button>
                </div>
                
                <img
                  src={photo.photo_url_thumbnail || photo.photo_url_mobile || photo.photo_url}
                  alt={`Panorama ${index + 1}`}
                  className="w-16 h-16 object-cover rounded"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback: intentar mobile, luego original, luego placeholder
                    const target = e.currentTarget;
                    if (target.src === photo.photo_url_thumbnail && photo.photo_url_mobile) {
                      target.src = photo.photo_url_mobile;
                    } else if (target.src === photo.photo_url_mobile && photo.photo_url) {
                      target.src = photo.photo_url;
                    } else {
                      // Mostrar placeholder gris
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.placeholder-image')) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'placeholder-image w-16 h-16 bg-muted rounded flex items-center justify-center';
                        placeholder.innerHTML = '<span class="text-xs text-muted-foreground">360°</span>';
                        parent.appendChild(placeholder);
                      }
                    }
                  }}
                />
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{t('panorama.photo')} {index + 1}</p>
                    {photo.capture_date && (
                      <Badge variant="secondary" className="text-xs">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {format(parseISO(photo.capture_date), 'dd/MM/yyyy')}
                      </Badge>
                    )}
                  </div>
                  {photo.description && (
                    <p className="text-xs text-muted-foreground">{photo.description}</p>
                  )}
                  
                  {/* Editar fecha */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 p-1">
                        <CalendarIcon className="w-3 h-3" />
                        {t('panorama.changeDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={photo.capture_date ? parseISO(photo.capture_date) : new Date()}
                        onSelect={(date) => date && updateCaptureDate(photo.id, date)}
                        locale={es}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(photo.photo_url, '_blank')}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(photo)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {photos.length === 0 && !uploading && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">{t('panorama.noPhotos')}</p>
            <p className="text-xs">{t('panorama.uploadFirst')}</p>
          </div>
        )}
      </div>
        </TabsContent>

        <TabsContent value="theta" className="space-y-4">
          {tourInfo && currentTenant ? (
            <ThetaCameraConnector
              hotspotId={hotspotId}
              tourId={tourId || tourInfo.tourId}
              tenantId={currentTenant.tenant_id}
              onPhotoSaved={() => {
                syncNow();
                loadPhotos();
              }}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Cargando información del tour...</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}