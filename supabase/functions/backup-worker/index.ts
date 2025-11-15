import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ==================== CONFIGURACIÓN OPTIMIZADA ====================
const IMAGES_PER_PART = 5; // Reducido de 10 a 5 para evitar CPU timeouts
const MAX_EXECUTION_TIME_MS = 50000; // 50s - margen antes del timeout de 60s
const RETRY_DELAY_BASE_MS = 5 * 60 * 1000; // 5 minutos

console.log('🚀 Backup Worker v2.0 - Incremental + Streaming');

serve(async (req) => {
  const startTime = Date.now();
  console.log(`📨 Request: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl!, supabaseServiceKey!);

    const { action, backupJobId, maxJobs = 1 } = await req.json();

    if (action === 'process_queue') {
      return await processBackupQueue(adminClient, maxJobs, startTime);
    } else if (action === 'process_job') {
      if (!backupJobId) throw new Error('backupJobId required');
      return await processSingleJob(backupJobId, adminClient, startTime);
    } else if (action === 'cleanup_stuck_jobs') {
      return await cleanupStuckJobs(adminClient);
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('💥 Worker error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Worker error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==================== PROCESAMIENTO DE COLA ====================
async function processBackupQueue(adminClient: any, maxJobs: number, startTime: number) {
  console.log(`🔄 Processing queue (max: ${maxJobs})`);

  const { data: queueItems, error: queueError } = await adminClient
    .from('backup_queue')
    .select(`
      id, backup_job_id, attempts, max_attempts,
      backup_jobs (id, tour_id, user_id, job_type, metadata)
    `)
    .in('status', ['pending', 'retry'])
    .lte('scheduled_at', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('scheduled_at', { ascending: true })
    .limit(maxJobs);

  if (queueError) throw queueError;

  console.log(`📋 Found: ${queueItems?.length || 0} jobs`);

  const results = {
    processed: 0,
    failed: 0,
    skipped: 0,
    timeout_saved: 0
  };

  // Procesar solo UN job por ejecución para evitar timeouts
  for (const queueItem of queueItems?.slice(0, 1) || []) {
    // ⏰ Timeout check
    if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
      console.log('⏰ Timeout approaching, stopping');
      results.timeout_saved++;
      break;
    }

    try {
      if (queueItem.attempts >= queueItem.max_attempts) {
        console.log(`⏭️ Skip ${queueItem.backup_job_id} - max attempts`);
        results.skipped++;
        continue;
      }

      // Marcar como processing
      await adminClient
        .from('backup_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: queueItem.attempts + 1
        })
        .eq('id', queueItem.id);

      // Obtener job completo
      const { data: backupJob } = await adminClient
        .from('backup_jobs')
        .select('*')
        .eq('id', queueItem.backup_job_id)
        .single();

      if (!backupJob) throw new Error('Job not found');

      // Obtener tour con relaciones
      const { data: tour } = await adminClient
        .from('virtual_tours')
        .select(`*, floor_plans (*), hotspots (*), panorama_photos (*)`)
        .eq('id', backupJob.tour_id)
        .single();

      if (!tour) throw new Error('Tour not found');

      backupJob.virtual_tours = tour;

      // 🎯 Procesamiento incremental (una parte por ejecución)
      await processBackupIncremental(
        queueItem.backup_job_id,
        backupJob,
        adminClient,
        startTime
      );

      // Completar queue item
      await adminClient
        .from('backup_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', queueItem.id);

      results.processed++;

    } catch (error) {
      console.error(`❌ Job ${queueItem.backup_job_id} failed:`, error);
      await handleFailedJob(queueItem, error, adminClient);
      results.failed++;
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ==================== PROCESAMIENTO INCREMENTAL ====================
async function processBackupIncremental(
  backupJobId: string,
  backupJob: any,
  adminClient: any,
  startTime: number
) {
  const tour = backupJob.virtual_tours;
  const userId = backupJob.user_id;
  
  console.log(`🔄 Incremental backup: ${tour.title}`);

  // Calcular imágenes totales
  const allImages: Array<{type: 'floor_plan' | 'panorama', data: any}> = [];
  
  for (const fp of (tour.floor_plans || [])) {
    if (fp.image_url) allImages.push({ type: 'floor_plan', data: fp });
  }
  
  for (const photo of (tour.panorama_photos || [])) {
    if (photo.photo_url) allImages.push({ type: 'panorama', data: photo });
  }

  const totalImages = allImages.length;
  const totalParts = Math.ceil(totalImages / IMAGES_PER_PART);
  
  // Obtener metadata
  const metadata = (backupJob.metadata || {}) as any;
  const currentPart = metadata.current_part || 1;
  
  console.log(`📦 ${totalImages} images, ${totalParts} parts. Processing part ${currentPart}/${totalParts}`);

  // Inicializar si es primera parte
  if (currentPart === 1) {
    await adminClient
      .from('backup_jobs')
      .update({
        status: 'processing',
        progress_percentage: 0,
        metadata: {
          multipart: true,
          current_part: 1,
          total_parts: totalParts,
          images_per_part: IMAGES_PER_PART,
          started_at: new Date().toISOString()
        }
      })
      .eq('id', backupJobId);
  }

  // ⏰ Timeout check
  if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
    console.log('⏰ Timeout, will retry next execution');
    return;
  }

  // Procesar solo esta parte
  const startIdx = (currentPart - 1) * IMAGES_PER_PART;
  const endIdx = Math.min(startIdx + IMAGES_PER_PART, totalImages);
  
  console.log(`📸 Processing images ${startIdx + 1}-${endIdx}`);

  // 🔥 Crear ZIP con streaming
  const zipBlob = await createZIPStreaming(
    tour,
    currentPart,
    totalParts,
    allImages.slice(startIdx, endIdx),
    adminClient,
    startTime
  );

  // ⏰ Timeout check post-ZIP
  if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
    console.log('⏰ Timeout after ZIP, saving progress');
    await saveProgress(backupJobId, currentPart, totalParts, adminClient);
    return;
  }

  console.log(`✅ ZIP part ${currentPart}: ${(zipBlob.length / 1024 / 1024).toFixed(2)} MB`);

  // 📤 Upload a Storage
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = sanitizeFilename(tour.title);
  const paddedPart = String(currentPart).padStart(3, '0');
  const filename = `${safeName}_backup_${timestamp}.zip.${paddedPart}`;
  const storagePath = `${userId}/${backupJobId}/${filename}`;
  
  const { error: uploadError } = await adminClient.storage
    .from('backups')
    .upload(storagePath, zipBlob, {
      contentType: 'application/octet-stream',
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  console.log(`✅ Uploaded: ${storagePath}`);

  // 📊 Actualizar progreso
  const progress = Math.round((currentPart / totalParts) * 100);

  // ¿Es la última parte?
  if (currentPart >= totalParts) {
    const { data: publicUrlData } = adminClient.storage
      .from('backups')
      .getPublicUrl(storagePath);

    await adminClient
      .from('backup_jobs')
      .update({
        status: 'completed',
        progress_percentage: 100,
        file_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        file_size: zipBlob.length,
        completed_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          current_part: currentPart,
          completed_at: new Date().toISOString()
        }
      })
      .eq('id', backupJobId);

    console.log(`🎉 Backup completed! All ${totalParts} parts done`);

    // 🔄 Trigger cloud sync (separado)
    triggerCloudSync(backupJobId, adminClient).catch(err => 
      console.warn('⚠️ Cloud sync trigger failed:', err)
    );

  } else {
    // Guardar progreso para siguiente parte
    await adminClient
      .from('backup_jobs')
      .update({
        progress_percentage: progress,
        metadata: {
          ...metadata,
          current_part: currentPart + 1,
          total_parts: totalParts,
          last_part_at: new Date().toISOString()
        }
      })
      .eq('id', backupJobId);

    console.log(`➡️ Part ${currentPart} done. Next: part ${currentPart + 1}`);

    // Re-encolar para siguiente parte
    await adminClient
      .from('backup_queue')
      .insert({
        backup_job_id: backupJobId,
        status: 'pending',
        priority: 5,
        scheduled_at: new Date(Date.now() + 5000).toISOString()
      });
  }
}

// ==================== CREAR ZIP CON STREAMING ====================
async function createZIPStreaming(
  tour: any,
  currentPart: number,
  totalParts: number,
  partImages: any[],
  adminClient: any,
  startTime: number
): Promise<Uint8Array> {
  const zip = new JSZip();

  console.log(`📦 Streaming ${partImages.length} images for part ${currentPart}...`);

  // README
  const readme = `
BACKUP PARTE ${currentPart} de ${totalParts}
Tour: ${tour.title}
Fecha: ${new Date().toISOString()}

Imágenes en esta parte: ${partImages.length}
`.trim();

  zip.addFile('README.txt', new TextEncoder().encode(readme));

  // Metadata
  const metadata = {
    tour_id: tour.id,
    tour_title: tour.title,
    part_number: currentPart,
    total_parts: totalParts,
    images_in_part: partImages.length,
    created_at: new Date().toISOString()
  };

  zip.addFile('metadata.json', new TextEncoder().encode(JSON.stringify(metadata, null, 2)));

  // 🔥 Procesar imágenes con streaming
  let processed = 0;
  for (const image of partImages) {
    // ⏰ Timeout check durante procesamiento
    if (Date.now() - startTime > MAX_EXECUTION_TIME_MS - 10000) {
      console.log('⏰ Timeout during ZIP, saving partial');
      break;
    }

    try {
      let imageUrl: string;
      let filename: string;

      if (image.type === 'floor_plan') {
        imageUrl = image.data.image_url;
        filename = `floor_plans/${sanitizeFilename(image.data.name)}.jpg`;
      } else {
        imageUrl = image.data.photo_url;
        const hotspot = tour.hotspots?.find((h: any) => h.id === image.data.hotspot_id);
        const hotspotName = sanitizeFilename(hotspot?.title || 'unknown');
        const date = image.data.capture_date || 'no-date';
        filename = `panoramas/${hotspotName}/${date}.jpg`;
      }

      // Download con streaming
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch ${filename}: ${response.status}`);
        continue;
      }

      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();

      zip.addFile(filename, new Uint8Array(buffer));
      processed++;

    } catch (error) {
      console.warn(`⚠️ Error processing image:`, error);
    }
  }

  console.log(`✅ Processed ${processed}/${partImages.length} images`);

  // Generar ZIP
  return await zip.generateAsync({ 
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

// ==================== CLOUD SYNC TRIGGER ====================
async function triggerCloudSync(backupJobId: string, adminClient: any) {
  console.log(`☁️ Triggering cloud sync: ${backupJobId}`);

  try {
    const { data: backupJob } = await adminClient
      .from('backup_jobs')
      .select('tenant_id, destination_id')
      .eq('id', backupJobId)
      .single();

    if (!backupJob?.destination_id) {
      console.log('ℹ️ No destination, skipping sync');
      return;
    }

    const { data: destination } = await adminClient
      .from('backup_destinations')
      .select('*')
      .eq('id', backupJob.destination_id)
      .eq('is_active', true)
      .single();

    if (!destination?.auto_backup_enabled) {
      console.log('ℹ️ Auto-backup not enabled, skipping');
      return;
    }

    // Invocar cloud-sync-worker
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/cloud-sync-worker`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          action: 'sync_backup',
          backupJobId
        })
      }
    );

    if (response.ok) {
      console.log('✅ Cloud sync triggered');
    } else {
      console.warn('⚠️ Cloud sync trigger failed:', await response.text());
    }

  } catch (error) {
    console.error('❌ Cloud sync trigger error:', error);
  }
}

// ==================== UTILIDADES ====================
async function saveProgress(jobId: string, part: number, total: number, adminClient: any) {
  await adminClient
    .from('backup_jobs')
    .update({
      metadata: {
        current_part: part,
        total_parts: total,
        timeout_saved_at: new Date().toISOString()
      }
    })
    .eq('id', jobId);

  console.log(`💾 Progress saved: ${part}/${total}`);
}

async function processSingleJob(backupJobId: string, adminClient: any, startTime: number) {
  console.log(`🔄 Single job: ${backupJobId}`);

  const { data: backupJob } = await adminClient
    .from('backup_jobs')
    .select('*')
    .eq('id', backupJobId)
    .single();

  if (!backupJob) throw new Error('Job not found');

  const { data: tour } = await adminClient
    .from('virtual_tours')
    .select(`*, floor_plans (*), hotspots (*), panorama_photos (*)`)
    .eq('id', backupJob.tour_id)
    .single();

  if (!tour) throw new Error('Tour not found');

  backupJob.virtual_tours = tour;

  await processBackupIncremental(backupJobId, backupJob, adminClient, startTime);

  return new Response(
    JSON.stringify({ success: true, jobId: backupJobId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function cleanupStuckJobs(adminClient: any) {
  console.log('🧹 Cleaning stuck jobs...');

  const { data: stuck } = await adminClient
    .from('backup_queue')
    .select('id, backup_job_id')
    .eq('status', 'processing')
    .lt('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

  let cleaned = 0;
  for (const job of stuck || []) {
    await adminClient
      .from('backup_queue')
      .update({
        status: 'retry',
        error_message: 'Timeout - reset for retry',
        scheduled_at: new Date(Date.now() + 60000).toISOString()
      })
      .eq('id', job.id);
    cleaned++;
  }

  return new Response(
    JSON.stringify({ cleaned, total: stuck?.length || 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleFailedJob(queueItem: any, error: any, adminClient: any) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.log(`❌ Failed: ${queueItem.backup_job_id}`);

  if (queueItem.attempts >= queueItem.max_attempts) {
    await adminClient
      .from('backup_queue')
      .update({
        status: 'failed',
        error_message: errorMsg,
        completed_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);

    await adminClient
      .from('backup_jobs')
      .update({
        status: 'failed',
        error_message: errorMsg,
        completed_at: new Date().toISOString()
      })
      .eq('id', queueItem.backup_job_id);
  } else {
    const retryDelay = RETRY_DELAY_BASE_MS * Math.pow(2, queueItem.attempts);
    await adminClient
      .from('backup_queue')
      .update({
        status: 'retry',
        error_message: errorMsg,
        scheduled_at: new Date(Date.now() + retryDelay).toISOString()
      })
      .eq('id', queueItem.id);
  }
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}
