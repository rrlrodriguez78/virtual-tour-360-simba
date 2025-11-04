import { isNativeApp, checkStoragePermission } from './storagePermissions';
import { 
  saveTourToFilesystem, 
  loadTourFromFilesystem, 
  getToursList, 
  deleteTour as deleteNativeTour,
  getStorageStats,
  StoredTour 
} from './nativeFileStorage';
import { tourOfflineCache } from './tourOfflineCache';
import type { Tour, FloorPlan, Hotspot } from '@/types/tour';
import pako from 'pako';
import { SyncEvents } from '@/services/sync-events';

// Storage adapter interface
export interface StorageAdapter {
  saveTour(
    tourId: string,
    tourName: string,
    tour: Tour,
    floorPlans: any[],
    hotspots: Hotspot[],
    photos?: any[]
  ): Promise<void>;
  loadTour(tourId: string): Promise<StoredTour | null>;
  listTours(): Promise<Array<{ 
    id: string; 
    name: string; 
    size: number; 
    lastModified: Date;
    lastSyncedAt?: string;
    hasLocalChanges?: boolean;
  }>>;
  deleteTour(tourId: string): Promise<void>;
  getStats(): Promise<{ 
    count: number; 
    size: number; 
    limit: number;
    availableSpace?: number;
  }>;
}

// Filesystem Adapter (for native mobile)
class FilesystemAdapter implements StorageAdapter {
  async saveTour(
    tourId: string,
    tourName: string,
    tour: Tour,
    floorPlans: any[],
    hotspots: Hotspot[],
    photos: any[] = []
  ): Promise<void> {
    // Compress tour data before saving
    const compressedTour = this.compressData(tour);
    const compressedHotspots = this.compressData(hotspots);
    
    await saveTourToFilesystem(
      tourId,
      tourName,
      { ...tour, _compressed: true },
      floorPlans,
      compressedHotspots,
      photos
    );
  }

  async loadTour(tourId: string): Promise<StoredTour | null> {
    const tour = await loadTourFromFilesystem(tourId);
    if (!tour) return null;
    
    // Decompress if compressed
    if ((tour.data as any)._compressed) {
      tour.data = this.decompressData(tour.data);
      tour.hotspots = this.decompressData(tour.hotspots);
    }
    
    return tour;
  }

  async listTours() {
    const tours = await getToursList();
    return tours.map(t => ({
      id: t.id,
      name: t.name,
      size: t.size,
      lastModified: new Date(t.cachedAt),
      lastSyncedAt: t.metadata.lastSyncedAt,
      hasLocalChanges: t.metadata.hasLocalChanges
    }));
  }

  async deleteTour(tourId: string): Promise<void> {
    await deleteNativeTour(tourId);
  }

  async getStats() {
    const stats = await getStorageStats();
    return {
      count: stats.totalTours,
      size: stats.totalSize,
      limit: stats.availableSpace, // No artificial limit on native
      availableSpace: stats.availableSpace
    };
  }

  // Compression helpers
  private compressData(data: any): any {
    try {
      const jsonString = JSON.stringify(data);
      const compressed = pako.deflate(jsonString);
      return {
        _compressed: true,
        data: Array.from(compressed)
      };
    } catch (error) {
      console.error('Compression error:', error);
      return data;
    }
  }

  private decompressData(data: any): any {
    try {
      if (data._compressed && data.data) {
        const uint8Array = new Uint8Array(data.data);
        const decompressed = pako.inflate(uint8Array, { to: 'string' });
        return JSON.parse(decompressed);
      }
      return data;
    } catch (error) {
      console.error('Decompression error:', error);
      return data;
    }
  }
}

// IndexedDB Adapter (for web)
class IndexedDBAdapter implements StorageAdapter {
  async saveTour(
    tourId: string,
    tourName: string,
    tour: Tour,
    floorPlans: any[],
    hotspots: Hotspot[]
  ): Promise<void> {
    await tourOfflineCache.downloadTourForOffline(tourId);
  }

  async loadTour(tourId: string): Promise<StoredTour | null> {
    const cached = await tourOfflineCache.getCachedTour(tourId);
    if (!cached) return null;
    
    // Convert to StoredTour format
    return {
      id: cached.tour.id!,
      name: cached.tour.title || 'Sin nombre',
      data: cached.tour,
      floorPlans: cached.floorPlans,
      hotspots: cached.hotspots,
      photos: [],
      metadata: {
        cachedAt: typeof cached.cachedAt === 'string' ? cached.cachedAt : new Date(cached.cachedAt).toISOString(),
        size: 0,
        photosCount: 0
      }
    };
  }

  async listTours() {
    const tours = await tourOfflineCache.getAllCachedTours();
    return tours.map(t => ({
      id: t.tour.id!,
      name: t.tour.title || 'Sin nombre',
      size: 0, // IndexedDB doesn't track individual sizes
      lastModified: new Date(t.cachedAt),
      lastSyncedAt: undefined,
      hasLocalChanges: false
    }));
  }

  async deleteTour(tourId: string): Promise<void> {
    await tourOfflineCache.deleteCachedTour(tourId);
  }

  async getStats() {
    const stats = await tourOfflineCache.getCacheStats();
    return {
      count: stats.toursCount,
      size: stats.totalSize,
      limit: stats.maxSize,
      availableSpace: stats.maxSize - stats.totalSize
    };
  }
}

// Pending Tour interface for offline creation
export interface PendingTour {
  id: string; // Local UUID
  title: string;
  description: string;
  coverImageUrl?: string;
  tourType: 'tour_360' | 'photo_tour';
  tenantId: string;
  synced: false;
  createdAt: string;
  lastSyncedAt?: string;
  hasLocalChanges?: boolean;
  remoteId?: string;
}

// Hybrid Storage Manager
class HybridStorageManager {
  private adapter: StorageAdapter | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly PENDING_TOURS_KEY = 'pending_tours';

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize() {
    const native = isNativeApp();
    console.log(`🔍 [HybridStorage] Initializing... Native: ${native}`);
    
    if (native) {
      // 🆕 FASE 2: Intentar crear carpetas reales para verificar permisos
      const permissionStatus = await checkStoragePermission();
      console.log(`📋 [HybridStorage] Permission status:`, permissionStatus);
      
      if (permissionStatus.granted) {
        // Verificar que REALMENTE podemos crear carpetas
        const canCreateFolders = await this.testFolderCreation();
        
        if (canCreateFolders) {
          this.adapter = new FilesystemAdapter();
          console.log('✅ [HybridStorage] Using Filesystem storage (native) - folders verified');
        } else {
          console.warn('⚠️ [HybridStorage] Permission granted but cannot create folders, falling back to IndexedDB');
          this.adapter = new IndexedDBAdapter();
        }
      } else {
        // Fallback to IndexedDB even on mobile if no permissions
        this.adapter = new IndexedDBAdapter();
        console.log('⚠️ [HybridStorage] No storage permissions, using IndexedDB fallback');
      }
    } else {
      this.adapter = new IndexedDBAdapter();
      console.log('✅ [HybridStorage] Using IndexedDB storage (web)');
    }
  }
  
  // 🆕 FASE 2: Prueba REAL de creación de carpetas
  private async testFolderCreation(): Promise<boolean> {
    try {
      console.log('🧪 [HybridStorage] Testing folder creation...');
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { getStorageDirectory, getBasePath } = await import('./storagePermissions');
      
      const testPath = `${getBasePath()}/test_${Date.now()}`;
      
      await Filesystem.mkdir({
        path: testPath,
        directory: getStorageDirectory(),
        recursive: true
      });
      
      console.log(`✅ [HybridStorage] Successfully created test folder: ${testPath}`);
      
      // Limpiar carpeta de prueba
      await Filesystem.rmdir({
        path: testPath,
        directory: getStorageDirectory(),
        recursive: true
      });
      
      return true;
    } catch (error) {
      console.error('❌ [HybridStorage] Failed to create test folder:', error);
      return false;
    }
  }

  // 🆕 FASE 2: Método para reinicializar el adapter después de conceder permisos
  async reinitialize() {
    console.log('🔄 Reinitializing storage adapter...');
    this.adapter = null; // Reset adapter
    await this.initialize();
  }

  private async ensureInitialized() {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
    if (!this.adapter) {
      throw new Error('Storage adapter not initialized');
    }
  }

  async saveTour(
    tourId: string,
    tourName: string,
    tour: Tour,
    floorPlans: any[],
    hotspots: Hotspot[],
    photos?: any[]
  ): Promise<void> {
    await this.ensureInitialized();
    
    // Check storage limit (only for IndexedDB, native has no artificial limits)
    if (this.adapter instanceof IndexedDBAdapter) {
      const storageLimitMB = parseInt(sessionStorage.getItem('user_storage_limit') || '1000'); // Increased to 1GB
      const stats = await this.adapter.getStats();
      
      if (stats.size / 1024 / 1024 > storageLimitMB) {
        throw new Error(`Límite de almacenamiento alcanzado: ${storageLimitMB}MB. Aumenta el límite en configuración o elimina tours antiguos.`);
      }
    }
    
    await this.adapter!.saveTour(tourId, tourName, tour, floorPlans, hotspots, photos);
    
    // Emitir evento de cambio
    SyncEvents.notifyDataChanged('virtual_tours', 'update', tourId);
  }

  async loadTour(tourId: string): Promise<StoredTour | null> {
    await this.ensureInitialized();
    return this.adapter!.loadTour(tourId);
  }

  async listTours() {
    await this.ensureInitialized();
    return this.adapter!.listTours();
  }

  async deleteTour(tourId: string): Promise<void> {
    await this.ensureInitialized();
    await this.adapter!.deleteTour(tourId);
    
    // Emitir evento de eliminación
    SyncEvents.notifyDataChanged('virtual_tours', 'delete', tourId);
  }

  async getStats() {
    await this.ensureInitialized();
    return this.adapter!.getStats();
  }

  async isUsingNativeStorage(): Promise<boolean> {
    await this.ensureInitialized();
    return this.adapter instanceof FilesystemAdapter;
  }

  // Create tour offline (stores in localStorage with synced: false)
  async createTourOffline(tourData: {
    title: string;
    description: string;
    coverImageUrl?: string;
    tourType: 'tour_360' | 'photo_tour';
    tenantId: string;
  }): Promise<PendingTour> {
    const localId = crypto.randomUUID();
    const pendingTour: PendingTour = {
      id: localId,
      title: tourData.title,
      description: tourData.description,
      coverImageUrl: tourData.coverImageUrl,
      tourType: tourData.tourType,
      tenantId: tourData.tenantId,
      synced: false,
      createdAt: new Date().toISOString(),
      hasLocalChanges: true
    };

    // Save to localStorage
    const pending = this.getPendingTours();
    pending.push(pendingTour);
    localStorage.setItem(this.PENDING_TOURS_KEY, JSON.stringify(pending));

    console.log('✅ Tour creado offline:', pendingTour);
    return pendingTour;
  }
  
  // Get metadata for a tour without loading all data
  async getTourMetadata(tourId: string): Promise<{
    exists: boolean;
    name?: string;
    size?: number;
    photosCount?: number;
    floorPlansCount?: number;
    lastModified?: Date;
  }> {
    await this.ensureInitialized();
    
    // Check pending tours first
    const pending = this.getPendingTours();
    const pendingTour = pending.find(t => t.id === tourId);
    if (pendingTour) {
      return {
        exists: true,
        name: pendingTour.title,
        photosCount: 0,
        floorPlansCount: 0
      };
    }
    
    // Check cached tours
    const tours = await this.listTours();
    const tour = tours.find(t => t.id === tourId);
    
    if (tour) {
      return {
        exists: true,
        name: tour.name,
        size: tour.size,
        lastModified: tour.lastModified
      };
    }
    
    return { exists: false };
  }

  // Get pending tours (not synced)
  getPendingTours(): PendingTour[] {
    try {
      const stored = localStorage.getItem(this.PENDING_TOURS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading pending tours:', error);
      return [];
    }
  }

  // Clean old pending tours (older than 7 days)
  cleanOldPendingTours(): number {
    try {
      const pending = this.getPendingTours();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const validTours = pending.filter(tour => {
        const createdAt = new Date(tour.createdAt);
        return createdAt > sevenDaysAgo;
      });
      
      const removedCount = pending.length - validTours.length;
      
      if (removedCount > 0) {
        localStorage.setItem(this.PENDING_TOURS_KEY, JSON.stringify(validTours));
        console.log(`🧹 Limpiados ${removedCount} tours pendientes antiguos (>7 días)`);
      }
      
      return removedCount;
    } catch (error) {
      console.error('Error cleaning old pending tours:', error);
      return 0;
    }
  }

  // Clean all old localStorage data related to tours
  cleanAllOldData(): { toursRemoved: number; keysRemoved: number } {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Clean pending tours
      const toursRemoved = this.cleanOldPendingTours();
      
      // Clean tour metadata that's older than 7 days
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('tour_metadata_')) {
          try {
            const metadata = JSON.parse(localStorage.getItem(key) || '{}');
            if (metadata.lastSyncedAt) {
              const lastSync = new Date(metadata.lastSyncedAt);
              if (lastSync < sevenDaysAgo) {
                keysToRemove.push(key);
              }
            } else if (metadata.cachedAt) {
              const cachedAt = new Date(metadata.cachedAt);
              if (cachedAt < sevenDaysAgo) {
                keysToRemove.push(key);
              }
            }
          } catch (e) {
            // Invalid metadata, remove it
            keysToRemove.push(key);
          }
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      if (toursRemoved > 0 || keysToRemove.length > 0) {
        console.log(`🧹 Auto-limpieza completada: ${toursRemoved} tours, ${keysToRemove.length} metadatos`);
      }
      
      return { toursRemoved, keysRemoved: keysToRemove.length };
    } catch (error) {
      console.error('Error during auto-cleanup:', error);
      return { toursRemoved: 0, keysRemoved: 0 };
    }
  }

  // Mark tour as synced and update its ID
  async markTourSynced(localId: string, remoteId?: string): Promise<void> {
    const pending = this.getPendingTours();
    const updated = pending.filter(t => t.id !== localId);
    localStorage.setItem(this.PENDING_TOURS_KEY, JSON.stringify(updated));
    
    if (remoteId) {
      // Update ID mapping
      const { updateMapping } = await import('./tourIdMapping');
      await updateMapping(localId, remoteId);
    }

    // Also update metadata to clear hasLocalChanges flag
    const key = `tour_metadata_${remoteId || localId}`;
    const metadata = JSON.parse(localStorage.getItem(key) || '{}');
    metadata.hasLocalChanges = false;
    metadata.lastSyncedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(metadata));
  }

  // Load tour offline (supports both local and remote IDs)
  async loadTourOffline(tourId: string): Promise<any> {
    // Check if it's a pending tour
    const pending = this.getPendingTours();
    const pendingTour = pending.find(t => t.id === tourId);
    
    if (pendingTour) {
      // Return minimal tour data for editing
      return {
        data: {
          id: pendingTour.id,
          title: pendingTour.title,
          description: pendingTour.description,
          cover_image_url: pendingTour.coverImageUrl,
          tour_type: pendingTour.tourType,
          tenant_id: pendingTour.tenantId,
          is_published: false,
          created_at: pendingTour.createdAt,
          updated_at: pendingTour.createdAt
        },
        floorPlans: [],
        hotspots: [],
        photos: []
      };
    }

    // Try loading from cache
    return await this.loadTour(tourId);
  }
}

export const hybridStorage = new HybridStorageManager();
