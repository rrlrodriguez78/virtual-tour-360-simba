import { useState } from 'react';
import { customSupabase } from '@/integrations/supabase/custom-client';
import { toast } from 'sonner';

interface FileToMigrate {
  url: string;
  bucket: string;
  path: string;
  type: 'panorama' | 'floor_plan' | 'cover';
  recordId: string;
}

interface MigrationResult {
  success: boolean;
  file: FileToMigrate;
  oldUrl?: string;
  newUrl?: string;
  error?: string;
}

export function useStorageMigration() {
  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [migrationProgress, setMigrationProgress] = useState(0);
  
  const [filesFound, setFilesFound] = useState(0);
  const [filesProcessed, setFilesProcessed] = useState(0);
  const [filesSucceeded, setFilesSucceeded] = useState(0);
  const [filesFailed, setFilesFailed] = useState(0);
  
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [filesToMigrate, setFilesToMigrate] = useState<FileToMigrate[]>([]);

  const reset = () => {
    setIsScanning(false);
    setIsMigrating(false);
    setScanProgress(0);
    setMigrationProgress(0);
    setFilesFound(0);
    setFilesProcessed(0);
    setFilesSucceeded(0);
    setFilesFailed(0);
    setCurrentFile(null);
    setErrors([]);
    setFilesToMigrate([]);
  };

  const extractBucketAndPath = (url: string): { bucket: string; path: string } | null => {
    try {
      console.log('🔍 Parsing URL:', url);
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/storage/v1/object/public/');
      
      if (pathParts.length < 2) {
        console.warn('⚠️ URL no tiene formato esperado:', url);
        return null;
      }
      
      const [bucket, ...pathSegments] = pathParts[1].split('/');
      const result = {
        bucket,
        path: pathSegments.join('/')
      };
      
      console.log('✅ Parsed:', result);
      return result;
    } catch (error) {
      console.error('❌ Error parsing URL:', url, error);
      return null;
    }
  };

  const startScan = async () => {
    console.log('🚀 Iniciando escaneo de archivos...');
    setIsScanning(true);
    setErrors([]);
    const allFiles: FileToMigrate[] = [];

    try {
      // 1. Escanear panorama_photos
      console.log('📸 Escaneando panorama_photos...');
      setScanProgress(10);
      const { data: panoramas, error: panoramasError } = await customSupabase
        .from('panorama_photos')
        .select('id, photo_url')
        .not('photo_url', 'is', null);

      if (panoramasError) {
        console.error('❌ Error fetching panoramas:', panoramasError);
        throw panoramasError;
      }

      console.log(`✅ Found ${panoramas?.length || 0} panoramas`);

      if (panoramas) {
        panoramas.forEach(p => {
          const parsed = extractBucketAndPath(p.photo_url);
          if (parsed) {
            allFiles.push({
              url: p.photo_url,
              bucket: parsed.bucket,
              path: parsed.path,
              type: 'panorama',
              recordId: p.id
            });
          } else {
            console.warn('⚠️ No se pudo parsear panorama URL:', p.photo_url);
          }
        });
      }

      // 2. Escanear floor_plans
      console.log('🗺️ Escaneando floor_plans...');
      setScanProgress(40);
      const { data: floorPlans, error: floorPlansError } = await customSupabase
        .from('floor_plans')
        .select('id, image_url')
        .not('image_url', 'is', null);

      if (floorPlansError) {
        console.error('❌ Error fetching floor plans:', floorPlansError);
        throw floorPlansError;
      }

      console.log(`✅ Found ${floorPlans?.length || 0} floor plans`);

      if (floorPlans) {
        floorPlans.forEach(fp => {
          const parsed = extractBucketAndPath(fp.image_url);
          if (parsed) {
            allFiles.push({
              url: fp.image_url,
              bucket: parsed.bucket,
              path: parsed.path,
              type: 'floor_plan',
              recordId: fp.id
            });
          } else {
            console.warn('⚠️ No se pudo parsear floor plan URL:', fp.image_url);
          }
        });
      }

      // 3. Escanear virtual_tours cover images
      console.log('🖼️ Escaneando virtual_tours covers...');
      setScanProgress(70);
      const { data: tours, error: toursError } = await customSupabase
        .from('virtual_tours')
        .select('id, cover_image_url')
        .not('cover_image_url', 'is', null);

      if (toursError) {
        console.error('❌ Error fetching tours:', toursError);
        throw toursError;
      }

      console.log(`✅ Found ${tours?.length || 0} tours with covers`);

      if (tours) {
        tours.forEach(t => {
          const parsed = extractBucketAndPath(t.cover_image_url);
          if (parsed) {
            allFiles.push({
              url: t.cover_image_url,
              bucket: parsed.bucket,
              path: parsed.path,
              type: 'cover',
              recordId: t.id
            });
          } else {
            console.warn('⚠️ No se pudo parsear cover URL:', t.cover_image_url);
          }
        });
      }

      console.log(`📊 Total archivos encontrados: ${allFiles.length}`);
      setFilesToMigrate(allFiles);
      setFilesFound(allFiles.length);
      setScanProgress(100);
      
      toast.success(`✅ Escaneo completado: ${allFiles.length} archivos encontrados`);
    } catch (error: any) {
      console.error('❌ Error en el escaneo:', error);
      toast.error(`Error durante el escaneo: ${error.message}`);
      setErrors(prev => [...prev, `Error general: ${error.message}`]);
    } finally {
      setIsScanning(false);
    }
  };

  const migrateFile = async (file: FileToMigrate): Promise<MigrationResult> => {
    try {
      console.log(`📥 Descargando: ${file.bucket}/${file.path}`);
      
      // 1. Descargar archivo desde URL pública
      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log(`✅ Descargado: ${(blob.size / 1024).toFixed(2)} KB`);

      // 2. Subir a tu Supabase personal
      console.log(`📤 Subiendo a: ${file.bucket}/${file.path}`);
      const { error: uploadError } = await customSupabase.storage
        .from(file.bucket)
        .upload(file.path, blob, {
          upsert: true,
          contentType: blob.type || 'image/jpeg',
        });

      if (uploadError) {
        throw new Error(`Error al subir: ${uploadError.message}`);
      }

      // 3. Obtener URL pública del nuevo archivo
      const { data: publicUrlData } = customSupabase.storage
        .from(file.bucket)
        .getPublicUrl(file.path);

      const newUrl = publicUrlData.publicUrl;
      console.log(`✅ Nueva URL: ${newUrl}`);

      // 4. Actualizar URLs en la base de datos
      console.log(`🔄 Actualizando base de datos para ${file.type}...`);
      await updateDatabaseUrls(file, newUrl);

      return {
        success: true,
        file,
        oldUrl: file.url,
        newUrl,
      };
    } catch (error: any) {
      console.error(`❌ Error migrando ${file.bucket}/${file.path}:`, error);
      return {
        success: false,
        file,
        error: error.message,
      };
    }
  };

  const updateDatabaseUrls = async (file: FileToMigrate, newUrl: string) => {
    try {
      if (file.type === 'panorama') {
        const { error } = await customSupabase
          .from('panorama_photos')
          .update({
            photo_url: newUrl,
            photo_url_mobile: newUrl,
            photo_url_thumbnail: newUrl,
          })
          .eq('id', file.recordId);

        if (error) console.error('Error actualizando panorama_photos:', error);
      } else if (file.type === 'floor_plan') {
        const { error } = await customSupabase
          .from('floor_plans')
          .update({ image_url: newUrl })
          .eq('id', file.recordId);

        if (error) console.error('Error actualizando floor_plans:', error);
      } else if (file.type === 'cover') {
        const { error } = await customSupabase
          .from('virtual_tours')
          .update({ cover_image_url: newUrl })
          .eq('id', file.recordId);

        if (error) console.error('Error actualizando virtual_tours:', error);
      }
    } catch (error) {
      console.error('Error actualizando base de datos:', error);
    }
  };

  const startMigration = async () => {
    if (filesToMigrate.length === 0) {
      toast.error('No hay archivos para migrar');
      return;
    }

    setIsMigrating(true);
    setFilesProcessed(0);
    setFilesSucceeded(0);
    setFilesFailed(0);
    setErrors([]);

    for (let i = 0; i < filesToMigrate.length; i++) {
      const file = filesToMigrate[i];
      setCurrentFile(`${file.bucket}/${file.path}`);
      setMigrationProgress(Math.round(((i + 1) / filesToMigrate.length) * 100));

      const result = await migrateFile(file);
      
      setFilesProcessed(prev => prev + 1);
      
      if (result.success) {
        setFilesSucceeded(prev => prev + 1);
      } else {
        setFilesFailed(prev => prev + 1);
        setErrors(prev => [...prev, `${file.bucket}/${file.path}: ${result.error}`]);
      }

      // Pequeño delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsMigrating(false);
    setCurrentFile(null);

    if (filesFailed === 0) {
      toast.success(`🎉 ¡Migración completada! ${filesSucceeded} archivos migrados exitosamente`);
    } else {
      toast.warning(`Migración completada con ${filesFailed} errores. ${filesSucceeded} archivos exitosos.`);
    }
  };

  return {
    isScanning,
    isMigrating,
    scanProgress,
    migrationProgress,
    filesFound,
    filesProcessed,
    filesSucceeded,
    filesFailed,
    currentFile,
    errors,
    filesToMigrate,
    startScan,
    startMigration,
    reset,
  };
}
