/**
 * Sistema de almacenamiento offline para tours completos
 * Permite descargar tours con todas sus fotos para trabajo offline
 */

export interface OfflineTour {
  id: string;
  title: string;
  description: string;
  tenant_id: string;
  tour_type: 'tour_360' | 'photo_tour';
  cover_image_url?: string;
  downloadedAt: Date;
  lastModifiedAt: Date;
  status: 'downloaded' | 'modified' | 'syncing' | 'error';
  localChanges: {
    newPhotos: number;
    editedMetadata: boolean;
  };
  floorPlans: OfflineFloorPlan[];
  syncError?: string;
}

export interface OfflineFloorPlan {
  id: string;
  name: string;
  image_url: string;
  image_blob?: Blob;
  tour_id: string;
  hotspots: OfflineHotspot[];
}

export interface OfflineHotspot {
  id: string;
  title: string;
  description?: string;
  floor_plan_id: string;
  x_position: number;
  y_position: number;
  photos: OfflinePhoto[];
}

export interface OfflinePhoto {
  id: string;
  hotspot_id: string;
  photo_url: string;
  photo_blob?: Blob;
  description?: string;
  display_order: number;
  capture_date?: string;
  isNew?: boolean; // Para fotos agregadas offline
}

const DB_NAME = 'OfflineTourStorage';
const DB_VERSION = 2;
const TOURS_STORE = 'offline_tours';

class OfflineTourStorage {
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
        
        // Eliminar stores antiguos si existen
        if (db.objectStoreNames.contains(TOURS_STORE)) {
          db.deleteObjectStore(TOURS_STORE);
        }
        
        // Crear store para tours
        const toursStore = db.createObjectStore(TOURS_STORE, { keyPath: 'id' });
        toursStore.createIndex('status', 'status', { unique: false });
        toursStore.createIndex('tenant_id', 'tenant_id', { unique: false });
        toursStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      };
    });
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  /**
   * Guarda un tour completo offline con todos sus datos
   */
  async saveTour(tour: OfflineTour): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TOURS_STORE], 'readwrite');
      const store = transaction.objectStore(TOURS_STORE);
      const request = store.put(tour);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene todos los tours descargados
   */
  async getDownloadedTours(tenantId?: string): Promise<OfflineTour[]> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TOURS_STORE], 'readonly');
      const store = transaction.objectStore(TOURS_STORE);
      
      let request: IDBRequest;
      if (tenantId) {
        const index = store.index('tenant_id');
        request = index.getAll(tenantId);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene un tour específico por ID
   */
  async getTour(tourId: string): Promise<OfflineTour | null> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TOURS_STORE], 'readonly');
      const store = transaction.objectStore(TOURS_STORE);
      const request = store.get(tourId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Actualiza el estado de un tour
   */
  async updateTourStatus(
    tourId: string, 
    status: OfflineTour['status'],
    syncError?: string
  ): Promise<void> {
    const tour = await this.getTour(tourId);
    if (!tour) return;

    tour.status = status;
    tour.lastModifiedAt = new Date();
    if (syncError !== undefined) {
      tour.syncError = syncError;
    }

    await this.saveTour(tour);
  }

  /**
   * Agrega una nueva foto a un hotspot offline
   */
  async addPhotoToHotspot(
    tourId: string,
    hotspotId: string,
    photo: OfflinePhoto
  ): Promise<void> {
    const tour = await this.getTour(tourId);
    if (!tour) throw new Error('Tour not found offline');

    // Buscar el hotspot en los floor plans
    for (const floorPlan of tour.floorPlans) {
      const hotspot = floorPlan.hotspots.find(h => h.id === hotspotId);
      if (hotspot) {
        photo.isNew = true;
        hotspot.photos.push(photo);
        tour.localChanges.newPhotos++;
        tour.status = 'modified';
        tour.lastModifiedAt = new Date();
        await this.saveTour(tour);
        return;
      }
    }

    throw new Error('Hotspot not found in tour');
  }

  /**
   * Actualiza metadata de un tour offline
   */
  async updateTourMetadata(
    tourId: string,
    updates: Partial<Pick<OfflineTour, 'title' | 'description'>>
  ): Promise<void> {
    const tour = await this.getTour(tourId);
    if (!tour) throw new Error('Tour not found offline');

    Object.assign(tour, updates);
    tour.localChanges.editedMetadata = true;
    tour.status = 'modified';
    tour.lastModifiedAt = new Date();
    
    await this.saveTour(tour);
  }

  /**
   * Elimina un tour descargado
   */
  async deleteTour(tourId: string): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TOURS_STORE], 'readwrite');
      const store = transaction.objectStore(TOURS_STORE);
      const request = store.delete(tourId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene tours con cambios locales pendientes de sincronizar
   */
  async getModifiedTours(): Promise<OfflineTour[]> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TOURS_STORE], 'readonly');
      const store = transaction.objectStore(TOURS_STORE);
      const index = store.index('status');
      const request = index.getAll('modified');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Calcula el espacio usado por tours offline (aproximado)
   */
  async getStorageSize(): Promise<{ tours: number; sizeMB: number }> {
    const tours = await this.getDownloadedTours();
    let totalSize = 0;

    for (const tour of tours) {
      // Estimar tamaño basado en número de fotos y blobs
      for (const floorPlan of tour.floorPlans) {
        if (floorPlan.image_blob) {
          totalSize += floorPlan.image_blob.size;
        }
        for (const hotspot of floorPlan.hotspots) {
          for (const photo of hotspot.photos) {
            if (photo.photo_blob) {
              totalSize += photo.photo_blob.size;
            }
          }
        }
      }
    }

    return {
      tours: tours.length,
      sizeMB: Math.round((totalSize / (1024 * 1024)) * 10) / 10
    };
  }

  /**
   * Limpia tours descargados hace más de X días
   */
  async cleanOldTours(daysOld: number = 30): Promise<number> {
    const tours = await this.getDownloadedTours();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;
    for (const tour of tours) {
      if (tour.downloadedAt < cutoffDate && tour.status !== 'modified') {
        await this.deleteTour(tour.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

export const offlineTourStorage = new OfflineTourStorage();
