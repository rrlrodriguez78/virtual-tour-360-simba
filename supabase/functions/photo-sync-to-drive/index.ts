import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= ENCRYPTION UTILITIES =============

async function decryptToken(encryptedToken: string): Promise<string> {
  const encryptionKey = Deno.env.get('CLOUD_ENCRYPTION_KEY');
  if (!encryptionKey) throw new Error('CLOUD_ENCRYPTION_KEY not configured');
  
  const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}

async function encryptToken(token: string): Promise<string> {
  const encryptionKey = Deno.env.get('CLOUD_ENCRYPTION_KEY');
  if (!encryptionKey) throw new Error('CLOUD_ENCRYPTION_KEY not configured');
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token)
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// ============= TOKEN REFRESH =============

async function refreshGoogleToken(refreshToken: string, supabase: any, destinationId: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  const tokens = await response.json();
  
  if (tokens.error) {
    throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`);
  }
  
  const newAccessToken = tokens.access_token;
  const encryptedToken = await encryptToken(newAccessToken);
  
  await supabase
    .from('backup_destinations')
    .update({ cloud_access_token: encryptedToken })
    .eq('id', destinationId);
  
  console.log('✅ Google Drive token refreshed');
  return newAccessToken;
}

// ============= GOOGLE DRIVE UTILITIES =============

// Find existing file in Drive
async function findExistingFile(
  accessToken: string,
  fileName: string,
  parentId: string
): Promise<string | null> {
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(fileName)}' and '${parentId}' in parents and trashed=false&fields=files(id)`;
  
  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    console.error('❌ Error buscando archivo existente:', await response.text());
    return null;
  }

  const result = await response.json();
  if (result.files && result.files.length > 0) {
    console.log(`📁 Archivo existente encontrado: ${fileName} (${result.files[0].id})`);
    return result.files[0].id;
  }

  return null;
}

async function findOrCreateFolder(accessToken: string, folderName: string, parentId: string): Promise<string> {
  // Buscar carpeta existente
  const searchParams = new URLSearchParams({
    q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)'
  });

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?${searchParams}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const searchData = await searchResponse.json();

  if (searchData.files && searchData.files.length > 0) {
    console.log(`📁 Carpeta existente encontrada: ${folderName} (${searchData.files[0].id})`);
    return searchData.files[0].id;
  }

  // Crear nueva carpeta
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });

  const newFolder = await createResponse.json();
  console.log(`✅ Carpeta creada: ${folderName} (${newFolder.id})`);
  return newFolder.id;
}

async function uploadPhotoToDrive(
  accessToken: string,
  photoBlob: Blob,
  fileName: string,
  folderId: string
): Promise<string> {
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const metadata = {
    name: fileName,
    mimeType: 'image/webp',
    parents: [folderId]
  };

  // Convertir Blob a base64 de forma eficiente (sin spread operator)
  const arrayBuffer = await photoBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  const base64Photo = btoa(binary);

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: image/webp\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Photo +
    close_delim;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to upload photo: ${result.error?.message || 'Unknown error'}`);
  }

  console.log(`✅ Foto subida: ${fileName} (${result.id})`);
  return result.id;
}

// ============= UPLOAD WITH TOKEN REFRESH =============

async function uploadWithTokenRefresh(
  accessToken: string,
  refreshToken: string,
  photoBlob: Blob,
  fileName: string,
  folderId: string,
  supabase: any,
  destinationId: string
): Promise<string> {
  try {
    // Primer intento con el token actual
    return await uploadPhotoToDrive(accessToken, photoBlob, fileName, folderId);
  } catch (error: any) {
    // Si falla por autenticación, refrescar token y reintentar
    if (error.message.includes('invalid authentication') || 
        error.message.includes('Invalid Credentials') ||
        error.message.includes('Request had invalid')) {
      
      console.log('🔄 Token expired, refreshing...');
      
      const newAccessToken = await refreshGoogleToken(refreshToken, supabase, destinationId);
      
      console.log('✅ Token refreshed, retrying upload...');
      
      // Segundo intento con el nuevo token
      return await uploadPhotoToDrive(newAccessToken, photoBlob, fileName, folderId);
    }
    
    // Si el error no es de autenticación, propagarlo
    throw error;
  }
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, photoId, tenantId } = body;
    
    console.log(`🚀 Starting photo-sync-to-drive - Action: ${action}, PhotoID: ${photoId}, TenantID: ${tenantId}`);

    if (action === 'sync_photo') {
      console.log('📸 Photo sync started:', {
        photoId,
        tenantId,
        timestamp: new Date().toISOString()
      });

      // Obtener información de la foto con sus relaciones
      const { data: photo, error: photoError } = await supabase
        .from('panorama_photos')
        .select(`
          *,
          hotspots!inner(
            id,
            title,
            floor_plans!inner(
              id,
              name,
              virtual_tours!inner(
                id,
                title,
                tenant_id
              )
            )
          )
        `)
        .eq('id', photoId)
        .single();

      if (photoError) throw photoError;
      if (!photo) throw new Error('Photo not found');

      const hotspot = photo.hotspots;
      const floorPlan = hotspot.floor_plans;
      const tour = floorPlan.virtual_tours;

      // Verificar que el tenant coincida
      if (tour.tenant_id !== tenantId) {
        throw new Error('Tenant mismatch');
      }

      // Obtener backup destination activo para este tenant
      const { data: destination, error: destError } = await supabase
        .from('backup_destinations')
        .select(`
          id,
          tenant_id,
          cloud_provider,
          cloud_folder_id,
          cloud_folder_path,
          cloud_access_token,
          cloud_refresh_token,
          is_active
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('cloud_provider', 'google_drive')
        .single();

      if (destError || !destination) {
        console.log('⚠️ No active Google Drive destination found for tenant:', tenantId);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'No Google Drive configured' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('📂 Destination found:', {
        destinationId: destination.id,
        provider: destination.cloud_provider,
        rootFolder: destination.cloud_folder_id
      });

      // Desencriptar tokens
      const accessToken = await decryptToken(destination.cloud_access_token);
      const refreshToken = await decryptToken(destination.cloud_refresh_token);

      // Crear estructura de carpetas en Google Drive
      // VirtualTours_Backups/[Tour Name]/[Floor Plan Name]/[Hotspot Name]/fotos-originales/[Fecha]/
      
      const rootFolderId = destination.cloud_folder_id;
      
      const tourFolderId = await findOrCreateFolder(accessToken, tour.title, rootFolderId);
      const floorPlanFolderId = await findOrCreateFolder(accessToken, floorPlan.name, tourFolderId);
      const hotspotFolderId = await findOrCreateFolder(accessToken, hotspot.title, floorPlanFolderId);
      const fotosOriginalesFolderId = await findOrCreateFolder(accessToken, 'fotos-originales', hotspotFolderId);
      
      // Formatear fecha: YYYY-MM-DD
      const captureDate = photo.capture_date 
        ? new Date(photo.capture_date).toISOString().split('T')[0]
        : new Date(photo.created_at).toISOString().split('T')[0];
      
      const dateFolderId = await findOrCreateFolder(accessToken, captureDate, fotosOriginalesFolderId);

      // Descargar foto del storage de Supabase
      console.log(`📥 Downloading photo from storage: ${photo.photo_url}`);
      
      const storagePath = photo.photo_url.split('tour-images/')[1];
      if (!storagePath) {
        throw new Error(`Invalid photo URL format: ${photo.photo_url}`);
      }
      
      console.log(`📂 Storage path: ${storagePath}`);
      
      const { data: photoBlob, error: downloadError } = await supabase.storage
        .from('tour-images')
        .download(storagePath);

      if (downloadError) {
        console.error('❌ Storage download error:', downloadError);
        throw downloadError;
      }
      if (!photoBlob) throw new Error('Photo file not found');

      console.log(`✅ Photo downloaded - Size: ${photoBlob.size} bytes (${(photoBlob.size / 1024 / 1024).toFixed(2)} MB)`);

      // Check if file already exists in Drive
      const fileName = photo.original_filename || `photo_${photo.id}.webp`;
      let driveFileId = await findExistingFile(
        accessToken,
        fileName,
        dateFolderId
      );

      // If file doesn't exist, upload it
      if (!driveFileId) {
        console.log(`📂 Uploading to Drive as: ${fileName}`);
        driveFileId = await uploadWithTokenRefresh(
          accessToken,
          refreshToken,
          photoBlob,
          fileName,
          dateFolderId,
          supabase,
          destination.id
        );
        console.log(`✅ Photo uploaded to Drive successfully - Drive ID: ${driveFileId}`);
      } else {
        console.log('⏭️ Archivo ya existe en Drive, omitiendo subida');
      }

      // Registrar en cloud_file_mappings
      await supabase
        .from('cloud_file_mappings')
        .insert({
          destination_id: destination.id,
          tour_id: tour.id,
          floor_plan_id: floorPlan.id,
          hotspot_id: hotspot.id,
          photo_id: photo.id,
          local_file_url: photo.photo_url,
          local_file_type: 'photo_original',
          cloud_file_id: driveFileId,
          cloud_file_path: `/${tour.title}/${floorPlan.name}/${hotspot.title}/fotos-originales/${captureDate}/${fileName}`,
          cloud_file_name: fileName,
          file_size_bytes: photoBlob.size,
          backed_up_at: new Date().toISOString(),
          metadata: {
            photo_id: photo.id,
            hotspot_id: hotspot.id,
            floor_plan_id: floorPlan.id,
            floor_plan_name: floorPlan.name,
            tour_id: tour.id,
            capture_date: captureDate,
            hotspot_name: hotspot.title,
            tour_name: tour.title
          }
        });

      const cloudFilePath = `/${tour.title}/${floorPlan.name}/${hotspot.title}/fotos-originales/${captureDate}/${fileName}`;
      
      console.log(`🎉 Sync completed for photo ${photoId}`);
      console.log('✅ Photo synced successfully:', {
        driveFileId,
        cloudFilePath,
        photoId: photo.id,
        fileSize: photoBlob.size
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          driveFileId,
          path: cloudFilePath,
          message: 'Photo synced successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync_floor_plan') {
      console.log('🗺️ Floor plan image sync started:', {
        tenantId,
        timestamp: new Date().toISOString()
      });

      const { imageUrl, tourId, floorPlanId, fileName } = body;

      if (!imageUrl || !tourId || !floorPlanId) {
        throw new Error('Missing required fields: imageUrl, tourId, floorPlanId');
      }

      // Obtener información del floor plan y tour
      const { data: floorPlan, error: floorPlanError } = await supabase
        .from('floor_plans')
        .select(`
          id,
          name,
          image_url,
          virtual_tours!inner(
            id,
            title,
            tenant_id
          )
        `)
        .eq('id', floorPlanId)
        .single();

      if (floorPlanError) throw floorPlanError;
      if (!floorPlan) throw new Error('Floor plan not found');

      const tour = floorPlan.virtual_tours;

      // Verificar tenant
      if (tour.tenant_id !== tenantId) {
        throw new Error('Tenant mismatch');
      }

      // Obtener backup destination
      const { data: destination, error: destError } = await supabase
        .from('backup_destinations')
        .select(`
          id,
          tenant_id,
          cloud_provider,
          cloud_folder_id,
          cloud_access_token,
          cloud_refresh_token,
          is_active
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('cloud_provider', 'google_drive')
        .single();

      if (destError || !destination) {
        console.log('⚠️ No active Google Drive destination');
        return new Response(
          JSON.stringify({ success: false, message: 'No Google Drive configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Desencriptar tokens
      const accessToken = await decryptToken(destination.cloud_access_token);
      const refreshToken = await decryptToken(destination.cloud_refresh_token);

      // Crear estructura: VirtualTours_Backups/[Tour]/[FloorPlanName]/
      const rootFolderId = destination.cloud_folder_id;
      const tourFolderId = await findOrCreateFolder(accessToken, tour.title, rootFolderId);
      const floorPlanFolderId = await findOrCreateFolder(accessToken, floorPlan.name, tourFolderId);

      console.log('📁 Folder structure for floor plan:', {
        root: rootFolderId,
        tour: tourFolderId,
        floorPlan: floorPlanFolderId
      });

      // Descargar imagen del storage
      const storagePath = imageUrl.split('tour-images/')[1];
      if (!storagePath) {
        throw new Error(`Invalid image URL: ${imageUrl}`);
      }

      const { data: imageBlob, error: downloadError } = await supabase.storage
        .from('tour-images')
        .download(storagePath);

      if (downloadError) throw downloadError;
      if (!imageBlob) throw new Error('Floor plan image not found');

      console.log(`📦 Floor plan image downloaded: ${imageBlob.size} bytes`);

      // Check if file already exists in Drive
      const originalFileName = fileName || `plano_${floorPlan.name}.webp`;
      let driveFileId = await findExistingFile(
        accessToken,
        originalFileName,
        floorPlanFolderId
      );

      // If file doesn't exist, upload it
      if (!driveFileId) {
        driveFileId = await uploadWithTokenRefresh(
          accessToken,
          refreshToken,
          imageBlob,
          originalFileName,
          floorPlanFolderId,
          supabase,
          destination.id
        );
      } else {
        console.log('⏭️ Floor plan ya existe en Drive, omitiendo subida');
      }

      // Registrar en cloud_file_mappings
      const cloudFilePath = `/${tour.title}/${floorPlan.name}/${originalFileName}`;
      
      await supabase
        .from('cloud_file_mappings')
        .insert({
          destination_id: destination.id,
          tour_id: tour.id,
          floor_plan_id: floorPlan.id,
          local_file_url: imageUrl,
          local_file_type: 'floor_plan',
          cloud_file_id: driveFileId,
          cloud_file_path: cloudFilePath,
          cloud_file_name: originalFileName,
          file_size_bytes: imageBlob.size,
          backed_up_at: new Date().toISOString()
        });

      console.log('✅ Floor plan image synced:', {
        driveFileId,
        cloudFilePath,
        floorPlanName: floorPlan.name
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          driveFileId,
          cloudFilePath 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Photo sync failed:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // Detectar errores específicos de cuota
    const isQuotaError = errorMessage.includes('storage quota') || 
                         errorMessage.includes('insufficientFilePermissions') ||
                         errorMessage.includes('storageQuotaExceeded');
    
    const userFriendlyError = isQuotaError
      ? 'Tu almacenamiento de Google Drive está lleno. Por favor libera espacio o aumenta tu capacidad de almacenamiento.'
      : errorMessage;
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: userFriendlyError,
        errorType: isQuotaError ? 'QUOTA_EXCEEDED' : 'SYNC_ERROR',
        timestamp: new Date().toISOString()
      }),
      { 
        status: isQuotaError ? 507 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
