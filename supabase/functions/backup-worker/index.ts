import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

console.log('🔧 Backup Worker started - True Background Processing');

serve(async (req) => {
  console.log('📨 Worker request:', req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const adminClient = createClient(supabaseUrl!, supabaseServiceKey!);

    const { action, backupJobId, maxJobs = 3 } = await req.json();

    if (action === 'process_queue') {
      return await processBackupQueue(adminClient, maxJobs);
    } else if (action === 'process_job') {
      if (!backupJobId) {
        throw new Error('backupJobId is required');
      }
      return await processSingleBackupJob(backupJobId, adminClient);
    } else if (action === 'cleanup_stuck_jobs') {
      return await cleanupStuckJobs(adminClient);
    } else {
      throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('💥 Error in backup worker:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Worker error',
        details: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Procesar múltiples trabajos de la cola
async function processBackupQueue(adminClient: any, maxJobs: number = 3) {
  console.log(`🔄 Processing backup queue, max jobs: ${maxJobs}`);

  try {
    // Obtener trabajos pendientes de la cola
    const { data: queueItems, error: queueError } = await adminClient
      .from('backup_queue')
      .select(`
        id,
        backup_job_id,
        attempts,
        max_attempts,
        backup_jobs (
          id,
          tour_id,
          user_id,
          job_type,
          total_items,
          estimated_size_mb
        )
      `)
      .in('status', ['pending', 'retry'])
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(maxJobs);

    if (queueError) throw queueError;

    console.log(`📋 Found ${queueItems?.length || 0} jobs to process`);

    const results = {
      processed: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    // Procesar cada trabajo
    for (const queueItem of queueItems || []) {
      try {
        // Verificar intentos máximos
        if (queueItem.attempts >= queueItem.max_attempts) {
          console.log(`⏭️ Skipping job ${queueItem.backup_job_id} - max attempts reached`);
          results.skipped++;
          continue;
        }

        // Marcar como procesando
        await adminClient
          .from('backup_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
            attempts: queueItem.attempts + 1
          })
          .eq('id', queueItem.id);

        // Obtener datos completos del tour manualmente
        const { data: backupJob, error: jobError } = await adminClient
          .from('backup_jobs')
          .select('*')
          .eq('id', queueItem.backup_job_id)
          .single();

        if (jobError || !backupJob) {
          throw new Error(`Backup job not found: ${jobError?.message || 'No data'}`);
        }

        // Obtener tour y sus relaciones de forma explícita
        const { data: tour, error: tourError } = await adminClient
          .from('virtual_tours')
          .select('*')
          .eq('id', backupJob.tour_id)
          .single();

        if (tourError || !tour) {
          throw new Error(`Tour not found: ${tourError?.message || 'No data'}`);
        }

        // Obtener floor plans
        const { data: floorPlans } = await adminClient
          .from('floor_plans')
          .select('*')
          .eq('tour_id', tour.id);

        // Obtener hotspots a través de los floor plans
        const floorPlanIds = floorPlans?.map((fp: any) => fp.id) || [];
        const { data: hotspots } = await adminClient
          .from('hotspots')
          .select('*')
          .in('floor_plan_id', floorPlanIds);

        // Obtener panorama photos a través de los hotspots
        const hotspotIds = hotspots?.map((h: any) => h.id) || [];
        const { data: panoramaPhotos } = await adminClient
          .from('panorama_photos')
          .select('*')
          .in('hotspot_id', hotspotIds);

        // Construir el objeto completo
        const completeBackupJob = {
          ...backupJob,
          virtual_tours: {
            ...tour,
            floor_plans: floorPlans || [],
            hotspots: hotspots || [],
            panorama_photos: panoramaPhotos || []
          }
        };

        // Procesar el backup con los datos completos
        const result = await processBackupJob(
          queueItem.backup_job_id,
          completeBackupJob,
          adminClient
        );

        if (result.success) {
          results.processed++;
          results.details.push({
            jobId: queueItem.backup_job_id,
            status: 'completed',
            partsCount: result.partsCount,
            totalSize: result.totalSize,
            totalItems: result.totalItems
          });
        } else {
          throw new Error(result.error);
        }

      } catch (error) {
        console.error(`❌ Failed to process job ${queueItem.backup_job_id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed++;
        results.details.push({
          jobId: queueItem.backup_job_id,
          status: 'failed',
          error: errorMessage
        });

        // Manejar reintento o fallo permanente
        await handleFailedJob(queueItem, error, adminClient);
      }
    }

    console.log(`✅ Queue processing completed:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Error processing queue:', error);
    throw error;
  }
}

// Procesar un solo trabajo de backup
async function processSingleBackupJob(backupJobId: string, adminClient: any) {
  console.log(`🎯 Processing single backup job: ${backupJobId}`);

  try {
    // Obtener datos completos del trabajo manualmente (igual que en processBackupQueue)
    const { data: backupJob, error: jobError } = await adminClient
      .from('backup_jobs')
      .select('*')
      .eq('id', backupJobId)
      .single();

    if (jobError || !backupJob) {
      throw new Error(`Backup job not found: ${jobError?.message || 'No data'}`);
    }

    // Obtener tour y sus relaciones de forma explícita
    const { data: tour, error: tourError } = await adminClient
      .from('virtual_tours')
      .select('*')
      .eq('id', backupJob.tour_id)
      .single();

    if (tourError || !tour) {
      throw new Error(`Tour not found: ${tourError?.message || 'No data'}`);
    }

    // Obtener floor plans
    const { data: floorPlans } = await adminClient
      .from('floor_plans')
      .select('*')
      .eq('tour_id', tour.id);

    // Obtener hotspots a través de los floor plans
    const floorPlanIds = floorPlans?.map((fp: any) => fp.id) || [];
    const { data: hotspots } = await adminClient
      .from('hotspots')
      .select('*')
      .in('floor_plan_id', floorPlanIds);

    // Obtener panorama photos a través de los hotspots
    const hotspotIds = hotspots?.map((h: any) => h.id) || [];
    const { data: panoramaPhotos } = await adminClient
      .from('panorama_photos')
      .select('*')
      .in('hotspot_id', hotspotIds);

    // Construir el objeto completo
    const completeBackupJob = {
      ...backupJob,
      virtual_tours: {
        ...tour,
        floor_plans: floorPlans || [],
        hotspots: hotspots || [],
        panorama_photos: panoramaPhotos || []
      }
    };

    const result = await processBackupJob(backupJobId, completeBackupJob, adminClient);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error(`💥 Error processing single job ${backupJobId}:`, error);
    throw error;
  }
}

// FUNCIÓN PRINCIPAL DE PROCESAMIENTO DE BACKUP CON MULTIPART
async function processBackupJob(backupJobId: string, backupJob: any, adminClient: any) {
  const tour = backupJob.virtual_tours;
  const userId = backupJob.user_id;
  const backupType = backupJob.job_type;
  
  const IMAGES_PER_PART = 10;
  
  console.log(`🔄 Starting MULTIPART backup processing for: ${tour.title}`);

  let transactionStarted = false;
  
  try {
    // Marcar que iniciamos una transacción lógica
    transactionStarted = true;
    // Recopilar todas las imágenes
    const allImages: Array<{type: 'floor_plan' | 'panorama', data: any}> = [];
    
    for (const floorPlan of (tour.floor_plans || [])) {
      if (floorPlan.image_url) {
        allImages.push({ type: 'floor_plan', data: floorPlan });
      }
    }
    
    for (const photo of (tour.panorama_photos || [])) {
      if (photo.photo_url) {
        allImages.push({ type: 'panorama', data: photo });
      }
    }

    const totalImages = allImages.length;
    const totalParts = Math.ceil(totalImages / IMAGES_PER_PART);
    
    // Obtener metadata actual o inicializar
    const metadata = (backupJob.metadata || {}) as any;
    const currentPart = metadata.current_part || 1;
    
    console.log(`📦 Total images: ${totalImages}, Total parts: ${totalParts}, Current part: ${currentPart}`);
    
    // Si es la primera parte, inicializar metadata
    if (currentPart === 1) {
      const { error: initError } = await adminClient
        .from('backup_jobs')
        .update({
          status: 'processing',
          progress_percentage: 0,
          metadata: {
            multipart: true,
            current_part: 1,
            total_parts: totalParts,
            images_per_part: IMAGES_PER_PART
          }
        })
        .eq('id', backupJobId);
      
      if (initError) {
        console.error('❌ Error initializing backup metadata:', initError);
        throw new Error(`Failed to initialize backup: ${initError.message}`);
      }
    }

    // Calcular índices para esta parte
    const startIdx = (currentPart - 1) * IMAGES_PER_PART;
    const endIdx = Math.min(startIdx + IMAGES_PER_PART, totalImages);
    const partImages = allImages.slice(startIdx, endIdx);
    
    console.log(`\n📦 Processing part ${currentPart}/${totalParts} (images ${startIdx + 1}-${endIdx})`);
    
    // Crear ZIP para esta parte usando la nueva función organizada
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTourName = sanitizeFilename(tour.title);
    
    console.log(`📈 Generating organized ZIP for part ${currentPart}...`);
    const zipBlob = await createPartZip(
      tour,
      backupType,
      currentPart,
      totalParts,
      tour.title,
      adminClient
    );
    
    // Calcular items procesados en esta parte (para multipart, solo la porción correspondiente)
    const itemsInPart = partImages.length;

    console.log(`✅ Part ${currentPart} ZIP generated: ${(zipBlob.length / 1024 / 1024).toFixed(2)} MB`);

    // Formato: TourName_backup_timestamp.zip.001, .zip.002, etc.
    const paddedPartNumber = String(currentPart).padStart(3, '0');
    const baseFilename = `${safeTourName}_backup_${timestamp}`;
    const fullFilename = `${baseFilename}.zip.${paddedPartNumber}`;
    const partStoragePath = `${userId}/${backupJobId}/${fullFilename}`;
    
    const { error: uploadError } = await adminClient.storage
      .from('backups')
      .upload(partStoragePath, zipBlob, {
        contentType: 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
        metadata: {
          originalFilename: fullFilename,
          partNumber: String(currentPart),
          totalParts: String(totalParts)
        }
      });

    if (uploadError) {
      throw new Error(`Failed to upload part ${currentPart}: ${uploadError.message}`);
    }

    // Si es la primera parte, crear scripts de unión e instrucciones
    if (currentPart === 1) {
      await createMergeScripts(userId, backupJobId, baseFilename, totalParts, adminClient);
    }

    console.log(`✅ Part ${currentPart} uploaded`);

    // Generar URL firmada con nombre de archivo correcto
    const { data: signedUrlData } = await adminClient.storage
      .from('backups')
      .createSignedUrl(partStoragePath, 7 * 24 * 60 * 60, {
        download: fullFilename  // Forzar el nombre de descarga correcto
      });

    // Registrar parte en la base de datos
    await adminClient
      .from('backup_parts')
      .insert({
        backup_job_id: backupJobId,
        part_number: currentPart,
        file_url: signedUrlData?.signedUrl,
        storage_path: partStoragePath,
        file_size: zipBlob.length,
        file_hash: await generateFileHash(zipBlob),
        items_count: itemsInPart,
        status: 'completed',
        completed_at: new Date().toISOString()
      });

    // Actualizar progreso
    const progress = Math.round((currentPart / totalParts) * 100);
    await adminClient
      .from('backup_jobs')
      .update({
        processed_items: endIdx,
        progress_percentage: progress
      })
      .eq('id', backupJobId);

    console.log(`✅ Part ${currentPart}/${totalParts} completed (${progress}%)`);

    // Si hay más partes, invocar el worker para la siguiente parte
    if (currentPart < totalParts) {
      // Actualizar metadata con la siguiente parte
      await adminClient
        .from('backup_jobs')
        .update({
          metadata: {
            multipart: true,
            current_part: currentPart + 1,
            total_parts: totalParts,
            images_per_part: IMAGES_PER_PART
          }
        })
        .eq('id', backupJobId);

      console.log(`🔄 Invoking worker for part ${currentPart + 1}/${totalParts}`);
      
      // NO ESPERAR la respuesta - dejar que se ejecute en background
      const workerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/backup-worker`;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({
          action: 'process_job',
          backupJobId: backupJobId
        })
      }).catch(err => console.error('Error invoking worker:', err));

      return {
        success: true,
        backupId: backupJobId,
        partsCount: totalParts,
        currentPart: currentPart,
        totalSize: zipBlob.length,
        totalItems: totalImages,
        inProgress: true
      };
    }

    // Todas las partes completadas
    const { data: allParts } = await adminClient
      .from('backup_parts')
      .select('file_size, items_count')
      .eq('backup_job_id', backupJobId);

    const totalSize = allParts?.reduce((sum: number, part: any) => sum + (part.file_size || 0), 0) || 0;

    await adminClient
      .from('backup_jobs')
      .update({
        status: 'completed',
        processed_items: totalImages,
        progress_percentage: 100,
        file_size: totalSize,
        storage_path: `${userId}/${backupJobId}/`,
        completed_at: new Date().toISOString(),
        metadata: {
          multipart: true,
          total_parts: totalParts,
          images_per_part: IMAGES_PER_PART,
          completed: true
        }
      })
      .eq('id', backupJobId);

    await adminClient
      .from('backup_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('backup_job_id', backupJobId);

    console.log(`🎉 Multipart backup completed: ${backupJobId} (${totalParts} parts)`);

    // Auto-sync to cloud if enabled
    try {
      // Check if tour has auto_backup_enabled in tour_backup_config
      const { data: tourConfig } = await adminClient
        .from('tour_backup_config')
        .select('*')
        .eq('tour_id', backupJob.tour_id)
        .eq('destination_id', backupJob.destination_id)
        .single();

      if (tourConfig?.auto_backup_enabled) {
        console.log(`🔄 Starting automatic cloud sync for job ${backupJobId}`);
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        // Call cloud-sync-worker in background (fire and forget)
        fetch(`${supabaseUrl}/functions/v1/cloud-sync-worker`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'sync_backup',
            backupJobId: backupJobId
          })
        }).then(res => res.json()).then(result => {
          console.log(`✅ Automatic sync initiated:`, result);
        }).catch(err => {
          console.error(`❌ Automatic sync failed:`, err);
        });
      } else {
        console.log(`ℹ️ Skipping automatic sync for job ${backupJobId} - tour auto_backup not enabled`);
      }
    } catch (error) {
      console.error('⚠️ Error checking auto-sync eligibility:', error);
      // Don't fail the backup if auto-sync check fails
    }

    return {
      success: true,
      backupId: backupJobId,
      partsCount: totalParts,
      totalSize: totalSize,
      totalItems: totalImages
    };

  } catch (error) {
    console.error(`💥 Error processing backup job ${backupJobId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Si estábamos en una transacción, hacer rollback limpiando estado
    if (transactionStarted) {
      console.log('🔄 Rolling back transaction state...');
      
      try {
        // Limpiar archivos parciales en storage si existen
        const metadata = (backupJob.metadata || {}) as any;
        if (metadata.current_part > 0) {
          console.log(`🗑️ Cleaning up partial files from part ${metadata.current_part}`);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Error during cleanup:', cleanupError);
      }
    }
    
    // Actualizar job como fallido con información detallada
    try {
      const { error: updateError } = await adminClient
        .from('backup_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          last_error: errorMessage,
          retry_count: (backupJob.retry_count || 0) + 1,
          completed_at: new Date().toISOString(),
          metadata: {
            ...(backupJob.metadata || {}),
            last_error_timestamp: new Date().toISOString(),
            transaction_rolled_back: transactionStarted
          }
        })
        .eq('id', backupJobId);
      
      if (updateError) {
        console.error('❌ Error updating failed job status:', updateError);
      }
    } catch (statusError) {
      console.error('❌ Critical error updating job status:', statusError);
    }
    
    // Actualizar cola con retry logic
    try {
      const retryCount = (backupJob.retry_count || 0) + 1;
      const maxRetries = backupJob.max_retries || 3;
      
      const { error: queueError } = await adminClient
        .from('backup_queue')
        .update({ 
          status: retryCount < maxRetries ? 'retry' : 'failed',
          error_message: errorMessage,
          attempts: retryCount,
          completed_at: retryCount >= maxRetries ? new Date().toISOString() : null,
          scheduled_at: retryCount < maxRetries 
            ? new Date(Date.now() + (Math.pow(2, retryCount) * 60000)).toISOString() // Exponential backoff
            : null
        })
        .eq('backup_job_id', backupJobId);
      
      if (queueError) {
        console.error('❌ Error updating queue status:', queueError);
      }
    } catch (queueUpdateError) {
      console.error('❌ Critical error updating queue:', queueUpdateError);
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

// Limpiar trabajos stuck
async function cleanupStuckJobs(adminClient: any) {
  console.log('🧹 Cleaning up stuck jobs');

  const { data: stuckJobs, error } = await adminClient
    .from('backup_queue')
    .update({
      status: 'retry',
      error_message: 'Reset by cleanup worker',
      scheduled_at: new Date().toISOString()
    })
    .eq('status', 'processing')
    .lt('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // 30 minutos
    .select();

  return new Response(
    JSON.stringify({
      cleaned: stuckJobs?.length || 0,
      message: 'Stuck jobs cleaned up'
    }),
    { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Manejar trabajos fallidos
async function handleFailedJob(queueItem: any, error: any, adminClient: any) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (queueItem.attempts + 1 >= queueItem.max_attempts) {
    // Máximo de intentos alcanzado
    await adminClient
      .from('backup_queue')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);

    await adminClient
      .from('backup_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', queueItem.backup_job_id);
  } else {
    // Programar reintento con backoff exponencial
    const retryDelay = Math.min(5 * 60 * 1000 * Math.pow(2, queueItem.attempts), 24 * 60 * 60 * 1000); // Máximo 24 horas
    const nextScheduled = new Date(Date.now() + retryDelay);

    await adminClient
      .from('backup_queue')
      .update({
        status: 'retry',
        error_message: errorMessage,
        scheduled_at: nextScheduled.toISOString()
      })
      .eq('id', queueItem.id);
  }
}

// FUNCIONES AUXILIARES

// Organizar backup con estructura jerárquica
interface OrganizedFloor {
  number: number;
  name: string;
  floorPlan: any;
  hotspots: {
    number: number;
    title: string;
    data: any;
    photos: {
      captureDate: string;
      order: number;
      data: any;
    }[];
  }[];
}

function organizeBackupStructure(tour: any): OrganizedFloor[] {
  const floors: OrganizedFloor[] = [];
  const floorPlans = tour.floor_plans || [];
  const hotspots = tour.hotspots || [];
  const photos = tour.panorama_photos || [];
  
  // Agrupar hotspots por floor_plan_id
  const hotspotsByFloor = new Map<string, any[]>();
  for (const hotspot of hotspots) {
    if (hotspot.floor_plan_id) {
      if (!hotspotsByFloor.has(hotspot.floor_plan_id)) {
        hotspotsByFloor.set(hotspot.floor_plan_id, []);
      }
      hotspotsByFloor.get(hotspot.floor_plan_id)!.push(hotspot);
    }
  }
  
  // Agrupar fotos por hotspot_id
  const photosByHotspot = new Map<string, any[]>();
  for (const photo of photos) {
    if (photo.hotspot_id) {
      if (!photosByHotspot.has(photo.hotspot_id)) {
        photosByHotspot.set(photo.hotspot_id, []);
      }
      photosByHotspot.get(photo.hotspot_id)!.push(photo);
    }
  }
  
  // Procesar cada piso
  floorPlans.forEach((floorPlan: any, floorIndex: number) => {
    const floorHotspots = hotspotsByFloor.get(floorPlan.id) || [];
    
    // Ordenar hotspots por título
    floorHotspots.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    
    const organizedHotspots = floorHotspots.map((hotspot, hotspotIndex) => {
      const hotspotPhotos = photosByHotspot.get(hotspot.id) || [];
      
      // Ordenar fotos por fecha de captura y display_order
      hotspotPhotos.sort((a, b) => {
        const dateA = a.capture_date || '0000-00-00';
        const dateB = b.capture_date || '0000-00-00';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.display_order || 0) - (b.display_order || 0);
      });
      
      return {
        number: hotspotIndex + 1,
        title: hotspot.title || `Punto ${hotspotIndex + 1}`,
        data: hotspot,
        photos: hotspotPhotos.map((photo, photoIndex) => ({
          captureDate: photo.capture_date || 'sin_fecha',
          order: photoIndex + 1,
          data: photo
        }))
      };
    });
    
    floors.push({
      number: floorIndex + 1,
      name: floorPlan.name || `Piso ${floorIndex + 1}`,
      floorPlan,
      hotspots: organizedHotspots
    });
  });
  
  return floors;
}

// Generar nombre de archivo con fecha
function generatePhotoFilename(captureDate: string, order: number, description?: string): string {
  const date = captureDate || 'sin_fecha';
  const orderStr = String(order).padStart(3, '0');
  const desc = description ? `_${sanitizeFilename(description).substring(0, 30)}` : '';
  return `${date}_${orderStr}_panorama${desc}.jpg`;
}

// Obtener todas las imágenes del tour (manteniendo relaciones completas)
async function getAllTourImages(tour: any, adminClient: any): Promise<any[]> {
  const images: any[] = [];
  
  // Agregar floor plans con sus hotspots
  for (const floorPlan of (tour.floor_plans || [])) {
    if (floorPlan.image_url) {
      const floorHotspots = (tour.hotspots || []).filter((h: any) => h.floor_plan_id === floorPlan.id);
      
      images.push({
        type: 'floor_plan',
        data: floorPlan,
        url: floorPlan.image_url,
        hotspots: floorHotspots
      });
    }
  }
  
  // Agregar panorama photos con su hotspot
  for (const photo of (tour.panorama_photos || [])) {
    if (photo.photo_url) {
      const hotspot = (tour.hotspots || []).find((h: any) => h.id === photo.hotspot_id);
      
      images.push({
        type: 'panorama', 
        data: photo,
        url: photo.photo_url,
        hotspot: hotspot
      });
    }
  }
  
  return images;
}

// Dividir imágenes en partes
function splitImagesIntoParts(images: any[], maxItemsPerPart: number): any[][] {
  const parts: any[][] = [];
  for (let i = 0; i < images.length; i += maxItemsPerPart) {
    parts.push(images.slice(i, i + maxItemsPerPart));
  }
  return parts;
}

// Crear registros de partes en la base de datos
async function createBackupParts(backupJobId: string, totalParts: number, adminClient: any): Promise<any[]> {
  const partRecords = [];
  
  for (let i = 1; i <= totalParts; i++) {
    const { data: part, error } = await adminClient
      .from('backup_parts')
      .insert({
        backup_job_id: backupJobId,
        part_number: i,
        status: 'pending',
        items_count: 0
      })
      .select()
      .single();
    
    if (!error && part) {
      partRecords.push(part);
    }
  }
  
  return partRecords;
}

// Crear ZIP con estructura jerárquica organizada
async function createPartZip(
  tour: any, 
  backupType: string, 
  partNumber: number, 
  totalParts: number,
  tourName: string, 
  adminClient: any
): Promise<Uint8Array> {
  const zip = new JSZip();
  const safeTourName = sanitizeFilename(tourName);
  const timestamp = new Date().toISOString();
  
  // Organizar estructura jerárquica
  const organizedFloors = organizeBackupStructure(tour);
  
  // Calcular estadísticas
  const totalFloors = organizedFloors.length;
  const totalHotspots = organizedFloors.reduce((sum, f) => sum + f.hotspots.length, 0);
  const totalPhotos = organizedFloors.reduce((sum, f) => 
    sum + f.hotspots.reduce((hSum, h) => hSum + h.photos.length, 0), 0
  );
  
  // TOUR_METADATA.json en la raíz
  const tourMetadata = {
    tour_name: tourName,
    tour_id: tour.id,
    backup_date: timestamp,
    backup_type: backupType,
    part_number: partNumber,
    total_parts: totalParts,
    total_floors: totalFloors,
    total_hotspots: totalHotspots,
    total_photos: totalPhotos,
    description: tour.description || ''
  };
  zip.addFile('TOUR_METADATA.json', JSON.stringify(tourMetadata, null, 2));
  
  // README.txt mejorado
  const readme = `╔════════════════════════════════════════════════════════════╗
║  BACKUP DE TOUR VIRTUAL - ${tourName.substring(0, 30).padEnd(30)}  ║
╚════════════════════════════════════════════════════════════╝

📅 INFORMACIÓN DEL BACKUP
─────────────────────────────────────────────────────────────
  Fecha de creación: ${new Date(timestamp).toLocaleString('es-ES')}
  Tipo de backup: ${backupType}
  Parte: ${partNumber} de ${totalParts}
  
📊 CONTENIDO
─────────────────────────────────────────────────────────────
  Pisos: ${totalFloors}
  Puntos de interés: ${totalHotspots}
  Fotos panorámicas: ${totalPhotos}

📁 ESTRUCTURA DEL BACKUP
─────────────────────────────────────────────────────────────
Este backup está organizado de la siguiente manera:

📦 ${safeTourName}_backup.zip
├── 📄 README.txt (este archivo)
├── 📄 TOUR_METADATA.json (información general del tour)
│
├── 📁 01_[Nombre_Piso]/
│   ├── 📄 FLOOR_INFO.json (metadata del piso)
│   ├── 🖼️ plano_[nombre].jpg (imagen del plano del piso)
│   │
│   ├── 📁 01_[Nombre_Punto]/
│   │   ├── 📄 HOTSPOT_INFO.json (metadata del punto)
│   │   ├── 📸 2025-01-15_001_panorama.jpg
│   │   ├── 📸 2025-01-15_002_panorama.jpg
│   │   └── 📸 2025-01-20_001_panorama.jpg
│   │
│   └── 📁 02_[Otro_Punto]/
│       └── ...
│
└── 📁 02_[Otro_Piso]/
    └── ...

🔢 CONVENCIONES DE NOMBRES
─────────────────────────────────────────────────────────────
  • Los pisos están numerados: 01_, 02_, 03_...
  • Los puntos están numerados dentro de cada piso: 01_, 02_, 03_...
  • Las fotos están ordenadas por fecha: AAAA-MM-DD_###_panorama.jpg
  • Cada carpeta contiene un archivo JSON con información completa

${totalParts > 1 ? `
🔗 ARCHIVOS MULTIPART
─────────────────────────────────────────────────────────────
Este backup está dividido en ${totalParts} partes. Para unirlas:

OPCIÓN 1 - Herramientas de compresión:
  • Windows: 7-Zip o WinRAR → Click derecho en .001 → Extraer
  • Mac: The Unarchiver → Doble click en .001
  • Linux: 7z x ${safeTourName}_backup.zip.001

OPCIÓN 2 - Línea de comandos:
  • Windows: copy /b ${safeTourName}_backup.zip.* ${safeTourName}_complete.zip
  • Mac/Linux: cat ${safeTourName}_backup.zip.* > ${safeTourName}_complete.zip

OPCIÓN 3 - Scripts incluidos:
  • Windows: Ejecutar merge.bat
  • Mac/Linux: bash merge.sh
  • PowerShell: ./merge.ps1
` : ''}

📝 ARCHIVOS JSON
─────────────────────────────────────────────────────────────
Cada nivel contiene archivos JSON con metadata completa:
  • TOUR_METADATA.json - Información general del tour
  • FLOOR_INFO.json - Detalles de cada piso
  • HOTSPOT_INFO.json - Información de cada punto de interés

💡 NOTAS
─────────────────────────────────────────────────────────────
  • Las fotos están organizadas cronológicamente por fecha de captura
  • Los nombres de archivo incluyen la fecha para fácil identificación
  • Esta estructura facilita la navegación y restauración del tour

═══════════════════════════════════════════════════════════════
`;
  zip.addFile('README.txt', readme);
  
  // Procesar cada piso
  for (const floor of organizedFloors) {
    const floorNumber = String(floor.number).padStart(2, '0');
    const safeFloorName = sanitizeFilename(floor.name);
    const floorPath = `${floorNumber}_${safeFloorName}`;
    
    // FLOOR_INFO.json
    const floorInfo = {
      floor_id: floor.floorPlan.id,
      floor_name: floor.name,
      floor_number: floor.number,
      capture_date: floor.floorPlan.capture_date || null,
      image_dimensions: {
        width: floor.floorPlan.width || null,
        height: floor.floorPlan.height || null
      },
      total_hotspots: floor.hotspots.length
    };
    zip.addFile(`${floorPath}/FLOOR_INFO.json`, JSON.stringify(floorInfo, null, 2));
    
    // Imagen del plano del piso
    try {
      if (floor.floorPlan.image_url) {
        const imagePath = extractPathFromUrl(floor.floorPlan.image_url);
        const { data: imageBlob, error: imageError } = await adminClient.storage
          .from('tour-images')
          .download(imagePath);
        
        if (!imageError && imageBlob) {
          const arrayBuffer = await imageBlob.arrayBuffer();
          const extension = floor.floorPlan.image_url.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
          zip.addFile(`${floorPath}/plano_${safeFloorName}.${extension}`, new Uint8Array(arrayBuffer));
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to process floor plan for ${floor.name}:`, error);
    }
    
    // Procesar cada hotspot del piso
    for (const hotspot of floor.hotspots) {
      const hotspotNumber = String(hotspot.number).padStart(2, '0');
      const safeHotspotTitle = sanitizeFilename(hotspot.title);
      const hotspotPath = `${floorPath}/${hotspotNumber}_${safeHotspotTitle}`;
      
      // HOTSPOT_INFO.json
      const dates = hotspot.photos.map(p => p.captureDate).filter(d => d !== 'sin_fecha');
      const hotspotInfo = {
        hotspot_id: hotspot.data.id,
        title: hotspot.title,
        description: hotspot.data.description || '',
        position: {
          x: hotspot.data.x_position,
          y: hotspot.data.y_position
        },
        total_photos: hotspot.photos.length,
        date_range: dates.length > 0 ? {
          first: dates[0],
          last: dates[dates.length - 1]
        } : null
      };
      zip.addFile(`${hotspotPath}/HOTSPOT_INFO.json`, JSON.stringify(hotspotInfo, null, 2));
      
      // Procesar cada foto del hotspot
      for (const photo of hotspot.photos) {
        try {
          if (photo.data.photo_url) {
            const imagePath = extractPathFromUrl(photo.data.photo_url);
            const { data: imageBlob, error: imageError } = await adminClient.storage
              .from('tour-images')
              .download(imagePath);
            
            if (!imageError && imageBlob) {
              const arrayBuffer = await imageBlob.arrayBuffer();
              const filename = generatePhotoFilename(
                photo.captureDate, 
                photo.order,
                photo.data.description
              );
              zip.addFile(`${hotspotPath}/${filename}`, new Uint8Array(arrayBuffer));
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to process photo in ${hotspot.title}:`, error);
        }
      }
    }
  }
  
  // Generar ZIP con compresión óptima
  console.log(`📦 Generating ZIP for part ${partNumber} with ${totalFloors} floors, ${totalHotspots} hotspots, ${totalPhotos} photos`);
  
  return await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

// Esta función ya no se usa - la funcionalidad está en processBackupJob
// Se mantiene por compatibilidad pero todo el upload se hace inline arriba

// Invocar siguiente parte
async function invokeNextPart(backupJobId: string): Promise<void> {
  try {
    const workerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/backup-worker`;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // No esperar respuesta - ejecutar en background
    fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        action: 'process_job',
        backupJobId: backupJobId
      })
    }).catch(err => console.error('Error invoking next part:', err));
    
  } catch (error) {
    console.error('Error setting up next part invocation:', error);
  }
}

// Marcar backup como completado
async function markBackupAsCompleted(backupJobId: string, adminClient: any): Promise<void> {
  // Calcular tamaño total
  const { data: parts } = await adminClient
    .from('backup_parts')
    .select('file_size, items_count')
    .eq('backup_job_id', backupJobId);

  const totalSize = parts?.reduce((sum: number, part: any) => sum + (part.file_size || 0), 0) || 0;
  const totalItems = parts?.reduce((sum: number, part: any) => sum + (part.items_count || 0), 0) || 0;

  // Actualizar backup job
  await adminClient
    .from('backup_jobs')
    .update({
      status: 'completed',
      processed_items: totalItems,
      progress_percentage: 100,
      file_size: totalSize,
      completed_at: new Date().toISOString()
    })
    .eq('id', backupJobId);

  // Actualizar queue
  await adminClient
    .from('backup_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('backup_job_id', backupJobId);

  console.log(`🎉 Backup completed: ${backupJobId}`);
}

// Calcular tamaño total del backup
async function calculateTotalBackupSize(backupJobId: string, adminClient: any): Promise<number> {
  const { data: parts } = await adminClient
    .from('backup_parts')
    .select('file_size')
    .eq('backup_job_id', backupJobId);

  return parts?.reduce((sum: number, part: any) => sum + (part.file_size || 0), 0) || 0;
}

function calculateTotalItems(tour: any, backupType: string): number {
  const baseItems = 1; // manifest.json
  const floorPlans = tour.floor_plans?.length || 0;
  const photos = tour.panorama_photos?.length || 0;

  if (backupType === 'media_only') {
    return baseItems + floorPlans + photos;
  }
  
  return baseItems + floorPlans + photos + (tour.hotspots?.length || 0);
}

// Extrae el path completo de una URL de storage
function extractPathFromUrl(url: string): string {
  try {
    // Si la URL contiene 'public/', extraer todo después de 'public/'
    if (url.includes('/public/')) {
      const parts = url.split('/public/');
      if (parts.length > 1) {
        // Remover el nombre del bucket del path
        const pathAfterPublic = parts[1];
        const pathParts = pathAfterPublic.split('/');
        // Saltar el nombre del bucket (primer elemento) y tomar el resto
        return pathParts.slice(1).join('/');
      }
    }
    
    // Fallback: extraer después de 'object/'
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const objectIndex = pathParts.indexOf('object');
    if (objectIndex !== -1 && objectIndex + 2 < pathParts.length) {
      const pathAfterObject = pathParts.slice(objectIndex + 2).join('/');
      // Si empieza con el nombre del bucket, removerlo
      const bucketRemoved = pathAfterObject.split('/').slice(1).join('/');
      return bucketRemoved || pathAfterObject;
    }
    
    return pathParts[pathParts.length - 1];
  } catch (error) {
    console.error('Error extracting path from URL:', url, error);
    return url.split('/').pop() || '';
  }
}

// Alias para backward compatibility
function extractFilenameFromUrl(url: string): string {
  return extractPathFromUrl(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 100);
}

async function generateFileHash(data: Uint8Array): Promise<string> {
  // Use a simple hex conversion without crypto.subtle to avoid type issues
  let hash = 0;
  for (let i = 0; i < Math.min(data.length, 1024); i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// Crear scripts de unión para Windows y Unix/Mac
async function createMergeScripts(userId: string, backupJobId: string, baseFilename: string, totalParts: number, adminClient: any): Promise<void> {
  console.log('📝 Creating merge scripts and instructions...');
  
  // Script para Windows (batch)
  let windowsScript = `@echo off
echo ========================================
echo   UNIR ARCHIVOS DE BACKUP
echo ========================================
echo.
echo Nombre del archivo: ${baseFilename}.zip
echo Total de partes: ${totalParts}
echo.

REM Verificar que todas las partes existen
set MISSING=0
`;

  for (let i = 1; i <= totalParts; i++) {
    const paddedNum = String(i).padStart(3, '0');
    windowsScript += `if not exist "${baseFilename}.zip.${paddedNum}" (\n  echo ERROR: Falta ${baseFilename}.zip.${paddedNum}\n  set MISSING=1\n)\n`;
  }

  windowsScript += `
if %MISSING%==1 (
  echo.
  echo Por favor descarga todas las partes antes de continuar.
  pause
  exit /b 1
)

echo Todas las partes encontradas. Uniendo archivos...
echo.

REM Unir todos los archivos
copy /b "${baseFilename}.zip.001`;
  
  for (let i = 2; i <= totalParts; i++) {
    const paddedNum = String(i).padStart(3, '0');
    windowsScript += `+${baseFilename}.zip.${paddedNum}`;
  }
  
  windowsScript += `" "${baseFilename}.zip"

if exist "${baseFilename}.zip" (
  echo.
  echo ========================================
  echo   BACKUP UNIDO EXITOSAMENTE!
  echo ========================================
  echo.
  echo Archivo creado: ${baseFilename}.zip
  echo Ahora puedes extraer el archivo ZIP.
  echo.
) else (
  echo.
  echo ERROR: No se pudo crear el archivo.
  echo.
)
pause
`;

  // Script para Unix/Mac (shell)
  let unixScript = `#!/bin/bash

echo "========================================"
echo "  UNIR ARCHIVOS DE BACKUP"
echo "========================================"
echo ""
echo "Nombre del archivo: ${baseFilename}.zip"
echo "Total de partes: ${totalParts}"
echo ""

# Verificar que todas las partes existen
MISSING=0
`;

  for (let i = 1; i <= totalParts; i++) {
    const paddedNum = String(i).padStart(3, '0');
    unixScript += `if [ ! -f "${baseFilename}.zip.${paddedNum}" ]; then\n  echo "ERROR: Falta ${baseFilename}.zip.${paddedNum}"\n  MISSING=1\nfi\n`;
  }

  unixScript += `
if [ $MISSING -eq 1 ]; then
  echo ""
  echo "Por favor descarga todas las partes antes de continuar."
  exit 1
fi

echo "Todas las partes encontradas. Uniendo archivos..."
echo ""

# Unir todos los archivos
cat ${baseFilename}.zip.* > ${baseFilename}.zip

if [ -f "${baseFilename}.zip" ]; then
  echo ""
  echo "========================================"
  echo "  BACKUP UNIDO EXITOSAMENTE!"
  echo "========================================"
  echo ""
  echo "Archivo creado: ${baseFilename}.zip"
  echo "Ahora puedes extraer el archivo ZIP."
  echo ""
else
  echo ""
  echo "ERROR: No se pudo crear el archivo."
  echo ""
fi
`;

  // README con instrucciones detalladas
  const readme = `========================================
  INSTRUCCIONES DE USO
========================================

Este backup está dividido en ${totalParts} partes para facilitar la descarga.

PASOS PARA RESTAURAR:

1. DESCARGAR TODOS LOS ARCHIVOS
   Descarga TODAS las partes del backup en la misma carpeta:
   ${baseFilename}.zip.001
   ${baseFilename}.zip.002
   ${baseFilename}.zip.003
   ...hasta...
   ${baseFilename}.zip.${String(totalParts).padStart(3, '0')}

2. DESCARGAR SCRIPT DE UNIÓN
   Descarga el script según tu sistema operativo:
   - Windows: UNIR_ARCHIVOS_WINDOWS.bat
   - Mac/Linux: UNIR_ARCHIVOS_MAC_LINUX.sh

3. EJECUTAR EL SCRIPT

   WINDOWS:
   - Doble click en UNIR_ARCHIVOS_WINDOWS.bat
   - O desde CMD: UNIR_ARCHIVOS_WINDOWS.bat
   
   MAC/LINUX:
   - Abre Terminal en la carpeta donde están los archivos
   - Dale permisos de ejecución: chmod +x UNIR_ARCHIVOS_MAC_LINUX.sh
   - Ejecuta: ./UNIR_ARCHIVOS_MAC_LINUX.sh

   MÉTODO MANUAL (si los scripts no funcionan):
   
   Windows (CMD):
   copy /b ${baseFilename}.zip.* ${baseFilename}.zip
   
   Mac/Linux (Terminal):
   cat ${baseFilename}.zip.* > ${baseFilename}.zip

4. EXTRAER EL ZIP
   Se creará el archivo: ${baseFilename}.zip
   Extraelo con tu programa favorito (WinRAR, 7-Zip, etc.)

========================================
  NOTAS IMPORTANTES
========================================

✓ Todos los archivos deben estar en la misma carpeta
✓ No cambies los nombres de los archivos
✓ Verifica que descargaste todas las partes antes de unirlas
✓ El archivo final tendrá todos los contenidos del tour

========================================
  CONTENIDO DEL BACKUP
========================================

- floor_plans/: Planos de planta del tour
- panoramas/: Fotos panorámicas organizadas por hotspot
- README.txt: Información de cada parte

Creado: ${new Date().toISOString()}
Total de partes: ${totalParts}
`;

  // Subir archivos
  try {
    await adminClient.storage
      .from('backups')
      .upload(`${userId}/${backupJobId}/UNIR_ARCHIVOS_WINDOWS.bat`, new TextEncoder().encode(windowsScript), {
        contentType: 'text/plain',
        upsert: true
      });

    await adminClient.storage
      .from('backups')
      .upload(`${userId}/${backupJobId}/UNIR_ARCHIVOS_MAC_LINUX.sh`, new TextEncoder().encode(unixScript), {
        contentType: 'text/plain',
        upsert: true
      });

    await adminClient.storage
      .from('backups')
      .upload(`${userId}/${backupJobId}/LEEME_INSTRUCCIONES.txt`, new TextEncoder().encode(readme), {
        contentType: 'text/plain',
        upsert: true
      });

    console.log('✅ Scripts de unión e instrucciones creados');
  } catch (error) {
    console.warn('⚠️ Error creando scripts de unión:', error);
  }
}
