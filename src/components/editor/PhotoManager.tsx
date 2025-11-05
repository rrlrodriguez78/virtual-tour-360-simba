import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Upload, Trash2, GripVertical, Eye, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
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

interface PhotoManagerProps {
  hotspotId: string;
}

export default function PhotoManager({ hotspotId }: PhotoManagerProps) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<PanoramaPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  
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
  }, [hotspotId]);

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
      console.error('Error loading photos:', error);
      toast.error('Error al cargar fotos');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Solo se permiten imágenes');
      return;
    }

    // NO VALIDATION for 2:1 ratio (removed for photo tours)

    const originalSize = file.size;
    setUploading(true);
    setUploadProgress({ progress: 10, status: 'Creando preview...' });
    
    try {
      setUploadProgress({ progress: 30, status: 'Optimizando imagen...' });
      
      const timestamp = Date.now();
      const baseFileName = `${hotspotId}/${timestamp}`;
      
      // Create optimized versions
      const versions = await createImageVersions(file, [
        { name: 'original', options: { maxWidth: 4000, quality: 0.85, format: 'webp', maxSizeMB: 10 } },
        { name: 'mobile', options: { maxWidth: 1920, quality: 0.85, format: 'webp', maxSizeMB: 10 } },
        { name: 'thumbnail', options: { maxWidth: 400, quality: 0.8, format: 'webp', maxSizeMB: 10 } }
      ]);
      
      const stats = getCompressionStats(originalSize, versions.original.optimizedSize);
      setCompressionStats({
        originalSize,
        finalSize: versions.original.optimizedSize,
        reduction: stats.savingsPercent
      });
      
      setUploadProgress({ progress: 60, status: 'Imagen optimizada ✓' });
      
      toast.success(
        `Optimizado: ${formatFileSize(originalSize)} → ${formatFileSize(versions.original.optimizedSize)} (-${stats.savingsPercent}%)`,
        { duration: 5000 }
      );

      // Upload all 3 versions
      setUploadProgress({ progress: 70, status: 'Subiendo...' });
      
      const [originalUpload, mobileUpload, thumbnailUpload] = await Promise.all([
        supabase.storage.from('tour-images').upload(`${baseFileName}.${versions.original.format}`, versions.original.blob),
        supabase.storage.from('tour-images').upload(`${baseFileName}_mobile.${versions.mobile.format}`, versions.mobile.blob),
        supabase.storage.from('tour-images').upload(`${baseFileName}_thumb.${versions.thumbnail.format}`, versions.thumbnail.blob),
      ]);

      if (originalUpload.error) throw originalUpload.error;
      if (mobileUpload.error) throw mobileUpload.error;
      if (thumbnailUpload.error) throw thumbnailUpload.error;
      
      setUploadProgress({ progress: 90, status: 'Finalizando...' });

      // Get public URLs
      const { data: { publicUrl: originalUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(`${baseFileName}.${versions.original.format}`);
      
      const { data: { publicUrl: mobileUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(`${baseFileName}_mobile.${versions.mobile.format}`);
      
      const { data: { publicUrl: thumbnailUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(`${baseFileName}_thumb.${versions.thumbnail.format}`);

      // Save to database
      const { error: dbError } = await supabase
        .from('panorama_photos')
        .insert({
          hotspot_id: hotspotId,
          photo_url: originalUrl,
          photo_url_mobile: mobileUrl,
          photo_url_thumbnail: thumbnailUrl,
          display_order: photos.length,
          capture_date: format(uploadDate, 'yyyy-MM-dd'),
          original_filename: file.name,
        });

      if (dbError) throw dbError;

      setUploadProgress({ progress: 100, status: '¡Completado!' });
      toast.success('Foto subida exitosamente');
      
      localStorage.setItem('lastUploadDate', format(uploadDate, 'yyyy-MM-dd'));
      loadPhotos();
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error(error.message || 'Error al subir foto');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleDelete = async (photo: PanoramaPhoto) => {
    if (!confirm('¿Eliminar esta foto?')) return;

    try {
      const fileName = photo.photo_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('tour-images')
          .remove([`${hotspotId}/${fileName}`]);
      }

      const { error } = await supabase
        .from('panorama_photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      toast.success('Foto eliminada');
      loadPhotos();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Error al eliminar foto');
    }
  };

  const updateCaptureDate = async (photoId: string, newDate: Date) => {
    try {
      const { error } = await supabase
        .from('panorama_photos')
        .update({ capture_date: format(newDate, 'yyyy-MM-dd') })
        .eq('id', photoId);

      if (error) throw error;
      
      toast.success('Fecha actualizada');
      loadPhotos();
    } catch (error) {
      console.error('Error updating capture date:', error);
      toast.error('Error al actualizar fecha');
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
      <div className="space-y-2">
        <Label>Subir Fotos</Label>
        
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-sm">Fecha de captura</Label>
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
          <label htmlFor="photo-upload" className="cursor-pointer">
            <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-1">
              Click para subir fotos normales o panorámicas
            </p>
            <p className="text-xs text-muted-foreground">
              Sube fotos normales o panorámicas (cualquier tamaño)
            </p>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {uploadProgress && (
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{uploadProgress.status}</span>
              <span className="text-muted-foreground">{Math.round(uploadProgress.progress)}%</span>
            </div>
            <Progress value={uploadProgress.progress} className="h-2" />
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="space-y-2">
          <Label>Fotos ({photos.length})</Label>
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
                  src={photo.photo_url_thumbnail || photo.photo_url}
                  alt={`Foto ${index + 1}`}
                  className="w-16 h-16 object-cover rounded"
                  loading="lazy"
                />
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Foto {index + 1}</p>
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
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 p-1">
                        <CalendarIcon className="w-3 h-3" />
                        Cambiar fecha
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
          <p className="text-sm">No hay fotos</p>
          <p className="text-xs">Sube la primera foto para comenzar</p>
        </div>
      )}
    </div>
  );
}
