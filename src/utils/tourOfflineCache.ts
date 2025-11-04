import { Tour, FloorPlan, Hotspot } from '@/types/tour';
import { supabase } from '@/integrations/supabase/custom-client';

interface CachedTour {
  tour: Tour;
  floorPlans: FloorPlan[];
  hotspots: Hotspot[];
  floorPlanImages: Map<string, Blob>;
  cachedAt: Date;
  expiresAt: Date;
  size: number; // Total size in bytes
}

interface CachedTourStorage {
  tour: Tour;
  floorPlans: FloorPlan[];
  hotspots: Hotspot[];
  floorPlanImages: { [key: string]: Blob };
  cachedAt: string;
  expiresAt: string;
  size: number;
}

const DB_NAME = 'TourOfflineCache';
const DB_VERSION = 2;
const TOUR_STORE = 'tours';
const CACHE_EXPIRATION_DAYS = 7;
const MAX_CACHED_TOURS = 5;
const MAX_CACHE_SIZE_MB = 100;
const MAX_IMAGE_SIZE_KB = 500;
const COMPRESSION_QUALITY = 0.8;

class TourOfflineCache {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        
        if (!db.objectStoreNames.contains(TOUR_STORE)) {
          const store = db.createObjectStore(TOUR_STORE, { keyPath: 'tourId' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        } else if (oldVersion < 2) {
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const store = transaction.objectStore(TOUR_STORE);
          
          if (!store.indexNames.contains('cachedAt')) {
            store.createIndex('cachedAt', 'cachedAt', { unique: false });
          }
          if (!store.indexNames.contains('expiresAt')) {
            store.createIndex('expiresAt', 'expiresAt', { unique: false });
          }
          if (!store.indexNames.contains('size')) {
            store.createIndex('size', 'size', { unique: false });
          }
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  /**
   * Comprime una imagen si excede el tamaño máximo
   */
  private async compressImage(blob: Blob): Promise<Blob> {
    if (blob.size <= MAX_IMAGE_SIZE_KB * 1024) {
      return blob;
    }

    console.log(`🗜️ Comprimiendo imagen de ${Math.round(blob.size / 1024)}KB...`);

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxDimension = 2048;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob) {
              console.log(`✅ Comprimido: ${Math.round(blob.size / 1024)}KB → ${Math.round(compressedBlob.size / 1024)}KB`);
              resolve(compressedBlob);
            } else {
              reject(new Error('No se pudo comprimir la imagen'));
            }
          },
          'image/jpeg',
          COMPRESSION_QUALITY
        );
      };

      img.onerror = () => reject(new Error('Error al cargar imagen'));
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Elimina el tour más antiguo
   */
  private async removeOldestTour(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([TOUR_STORE], 'readwrite');
    const store = transaction.objectStore(TOUR_STORE);
    const index = store.index('cachedAt');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor();
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          console.log(`🗑️ Eliminando tour antiguo: ${cursor.value.tourId}`);
          cursor.delete();
          resolve();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async downloadTourForOffline(tourId: string): Promise<void> {
    try {
      console.log(`📥 Descargando tour ${tourId} para uso offline...`);

      // Verificar espacio disponible
      const currentSize = await this.getCacheSize();
      const maxSize = MAX_CACHE_SIZE_MB * 1024 * 1024;
      
      if (currentSize > maxSize * 0.9) {
        console.warn(`⚠️ Caché cerca del límite (${Math.round(currentSize / 1024 / 1024)}MB/${MAX_CACHE_SIZE_MB}MB)`);
        await this.removeOldestTour();
      }

      // Verificar límite de tours
      const cachedTours = await this.getAllCachedTours();
      if (cachedTours.length >= MAX_CACHED_TOURS) {
        console.warn(`⚠️ Máximo de tours alcanzado, eliminando el más antiguo...`);
        await this.removeOldestTour();
      }

      // 1. Fetch tour data
      const { data: tour, error: tourError } = await supabase
        .from('virtual_tours')
        .select('*')
        .eq('id', tourId)
        .single();

      if (tourError || !tour) {
        throw new Error('No se pudo cargar el tour');
      }

      // 2. Fetch floor plans
      const { data: floorPlans, error: floorPlansError } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('tour_id', tourId);

      if (floorPlansError) {
        throw new Error('No se pudieron cargar los planos');
      }

      // 3. Fetch all hotspots
      const floorPlanIds = floorPlans?.map(fp => fp.id) || [];
      const { data: hotspots, error: hotspotsError } = await supabase
        .from('hotspots')
        .select('*')
        .in('floor_plan_id', floorPlanIds);

      if (hotspotsError) {
        throw new Error('No se pudieron cargar los hotspots');
      }

      // 4. Download and compress floor plan images
      const floorPlanImages: { [key: string]: Blob } = {};
      let totalImageSize = 0;
      
      for (const floorPlan of floorPlans || []) {
        try {
          const response = await fetch(floorPlan.image_url);
          if (response.ok) {
            const blob = await response.blob();
            const compressedBlob = await this.compressImage(blob);
            floorPlanImages[floorPlan.id] = compressedBlob;
            totalImageSize += compressedBlob.size;
          }
        } catch (error) {
          console.warn(`No se pudo descargar imagen del plano ${floorPlan.id}:`, error);
        }
      }

      // 5. Calculate total size
      const dataSize = 
        JSON.stringify(tour).length +
        JSON.stringify(floorPlans).length +
        JSON.stringify(hotspots).length;
      
      const totalSize = dataSize + totalImageSize;

      // 6. Store in IndexedDB
      const cachedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CACHE_EXPIRATION_DAYS);

      const cachedTourData: CachedTourStorage = {
        tour: tour as Tour,
        floorPlans: floorPlans || [],
        hotspots: hotspots || [],
        floorPlanImages,
        cachedAt: cachedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        size: totalSize,
      };

      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readwrite');
      const store = transaction.objectStore(TOUR_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put({ tourId, ...cachedTourData });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`✅ Tour descargado (${Math.round(totalSize / 1024)}KB)`);

    } catch (error) {
      console.error('Error downloading tour for offline:', error);
      throw error;
    }
  }

  async getCachedTour(tourId: string): Promise<CachedTour | null> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readonly');
      const store = transaction.objectStore(TOUR_STORE);

      const data = await new Promise<any>((resolve, reject) => {
        const request = store.get(tourId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!data) return null;

      const cachedTour: CachedTour = {
        tour: data.tour,
        floorPlans: data.floorPlans,
        hotspots: data.hotspots,
        floorPlanImages: new Map(Object.entries(data.floorPlanImages)),
        cachedAt: new Date(data.cachedAt),
        expiresAt: new Date(data.expiresAt),
        size: data.size || 0,
      };

      // Check if expired
      if (new Date() > cachedTour.expiresAt) {
        await this.deleteCachedTour(tourId);
        return null;
      }

      return cachedTour;
    } catch (error) {
      console.error('Error getting cached tour:', error);
      return null;
    }
  }

  async isTourCachedAndValid(tourId: string): Promise<boolean> {
    const cachedTour = await this.getCachedTour(tourId);
    return cachedTour !== null;
  }

  async deleteCachedTour(tourId: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readwrite');
      const store = transaction.objectStore(TOUR_STORE);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(tourId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error deleting cached tour:', error);
      throw error;
    }
  }

  async getAllCachedTours(): Promise<CachedTour[]> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readonly');
      const store = transaction.objectStore(TOUR_STORE);

      const allData = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const cachedTours: CachedTour[] = allData
        .map(data => ({
          tour: data.tour,
          floorPlans: data.floorPlans,
          hotspots: data.hotspots,
          floorPlanImages: new Map(Object.entries(data.floorPlanImages)) as Map<string, Blob>,
          cachedAt: new Date(data.cachedAt),
          expiresAt: new Date(data.expiresAt),
          size: data.size || 0,
        }))
        .filter(tour => new Date() <= tour.expiresAt);

      return cachedTours;
    } catch (error) {
      console.error('Error getting all cached tours:', error);
      return [];
    }
  }

  async cleanExpiredTours(): Promise<void> {
    try {
      const allTours = await this.getAllCachedTours();
      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readwrite');
      const store = transaction.objectStore(TOUR_STORE);

      const allKeys = await new Promise<string[]>((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
      });

      const validTourIds = new Set(allTours.map(t => t.tour.id));

      for (const key of allKeys) {
        if (!validTourIds.has(key)) {
          await this.deleteCachedTour(key);
        }
      }
    } catch (error) {
      console.error('Error cleaning expired tours:', error);
    }
  }

  async getFloorPlanImage(tourId: string, floorPlanId: string): Promise<Blob | null> {
    const cachedTour = await this.getCachedTour(tourId);
    if (!cachedTour) return null;
    
    return cachedTour.floorPlanImages.get(floorPlanId) || null;
  }

  async getCacheSize(): Promise<number> {
    try {
      const allTours = await this.getAllCachedTours();
      return allTours.reduce((total, tour) => total + tour.size, 0);
    } catch (error) {
      console.error('Error calculating cache size:', error);
      return 0;
    }
  }

  /**
   * Obtiene estadísticas del caché
   */
  async getCacheStats() {
    const allTours = await this.getAllCachedTours();
    const totalSize = await this.getCacheSize();
    const maxSize = MAX_CACHE_SIZE_MB * 1024 * 1024;
    
    return {
      toursCount: allTours.length,
      totalSize,
      maxSize,
      usagePercentage: (totalSize / maxSize) * 100,
      availableSpace: maxSize - totalSize,
      maxTours: MAX_CACHED_TOURS,
      expirationDays: CACHE_EXPIRATION_DAYS,
    };
  }
}

export const tourOfflineCache = new TourOfflineCache();
