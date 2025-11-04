import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client'; // Lovable Cloud
import { customSupabase } from '@/integrations/supabase/custom-client'; // Tu Supabase personal
import { toast } from 'sonner';

interface FileToMigrate {
  bucket: string;
  path: string;
  name: string;
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

  const BUCKETS_TO_SCAN = ['tour-images', 'panoramas', 'floor-plans', 'cover-images'];

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

  const startScan = async () => {
    setIsScanning(true);
    setErrors([]);
    const allFiles: FileToMigrate[] = [];

    try {
      for (let i = 0; i < BUCKETS_TO_SCAN.length; i++) {
        const bucket = BUCKETS_TO_SCAN[i];
        setScanProgress(Math.round(((i + 1) / BUCKETS_TO_SCAN.length) * 100));

        try {
          // Listar archivos en Lovable Cloud
          const { data, error } = await supabase.storage.from(bucket).list('', {
            limit: 1000,
            offset: 0,
          });

          if (error) {
            console.error(`Error al listar bucket ${bucket}:`, error);
            setErrors(prev => [...prev, `Error en bucket ${bucket}: ${error.message}`]);
            continue;
          }

          if (data && data.length > 0) {
            const filesInBucket = data
              .filter(file => file.name !== '.emptyFolderPlaceholder')
              .map(file => ({
                bucket,
                path: file.name,
                name: file.name,
              }));
            
            allFiles.push(...filesInBucket);
          }
        } catch (bucketError: any) {
          console.error(`Error al procesar bucket ${bucket}:`, bucketError);
          setErrors(prev => [...prev, `Error al procesar ${bucket}: ${bucketError.message}`]);
        }
      }

      setFilesToMigrate(allFiles);
      setFilesFound(allFiles.length);
      
      toast.success(`✅ Escaneo completado: ${allFiles.length} archivos encontrados`);
    } catch (error: any) {
      console.error('Error en el escaneo:', error);
      toast.error(`Error durante el escaneo: ${error.message}`);
      setErrors(prev => [...prev, `Error general: ${error.message}`]);
    } finally {
      setIsScanning(false);
      setScanProgress(100);
    }
  };

  const migrateFile = async (file: FileToMigrate): Promise<MigrationResult> => {
    try {
      // 1. Descargar archivo de Lovable Cloud
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from(file.bucket)
        .download(file.path);

      if (downloadError) {
        throw new Error(`Error al descargar: ${downloadError.message}`);
      }

      // 2. Subir a tu Supabase personal
      const { data: uploadData, error: uploadError } = await customSupabase.storage
        .from(file.bucket)
        .upload(file.path, downloadData, {
          upsert: true,
          contentType: downloadData.type,
        });

      if (uploadError) {
        throw new Error(`Error al subir: ${uploadError.message}`);
      }

      // 3. Obtener URL pública del nuevo archivo
      const { data: publicUrlData } = customSupabase.storage
        .from(file.bucket)
        .getPublicUrl(file.path);

      const newUrl = publicUrlData.publicUrl;

      // 4. Actualizar URLs en la base de datos según el bucket
      await updateDatabaseUrls(file, newUrl);

      return {
        success: true,
        file,
        newUrl,
      };
    } catch (error: any) {
      return {
        success: false,
        file,
        error: error.message,
      };
    }
  };

  const updateDatabaseUrls = async (file: FileToMigrate, newUrl: string) => {
    try {
      // Actualizar según el tipo de bucket
      if (file.bucket === 'panoramas') {
        // Actualizar panorama_photos
        const { error } = await customSupabase
          .from('panorama_photos')
          .update({
            photo_url: newUrl,
            photo_url_mobile: newUrl,
            photo_url_thumbnail: newUrl,
          })
          .like('photo_url', `%${file.name}%`);

        if (error) console.error('Error actualizando panorama_photos:', error);
      } else if (file.bucket === 'floor-plans') {
        // Actualizar floor_plans
        const { error } = await customSupabase
          .from('floor_plans')
          .update({ image_url: newUrl })
          .like('image_url', `%${file.name}%`);

        if (error) console.error('Error actualizando floor_plans:', error);
      } else if (file.bucket === 'cover-images' || file.bucket === 'tour-images') {
        // Actualizar virtual_tours
        const { error } = await customSupabase
          .from('virtual_tours')
          .update({ cover_image_url: newUrl })
          .like('cover_image_url', `%${file.name}%`);

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
