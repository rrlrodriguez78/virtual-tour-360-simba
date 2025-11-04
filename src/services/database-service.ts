import { hybridStorage, PendingTour } from '@/utils/hybridStorage';
import { supabase } from '@/integrations/supabase/custom-client';
import { SyncEvents } from './sync-events';
import type { Tour, FloorPlan, Hotspot } from '@/types/tour';

/**
 * DatabaseService - Wrapper unificado para Supabase + HybridStorage
 * Maneja sync automático online/offline con limpieza de metadatos
 */
export class DatabaseService {
  /**
   * Guardar tour con sync automático si está online
   */
  async saveTour(
    tourId: string,
    tourData: Tour,
    floorPlans: FloorPlan[] = [],
    hotspots: Hotspot[] = [],
    syncImmediately = false
  ): Promise<void> {
    const isOnline = navigator.onLine;

    if (isOnline && syncImmediately) {
      // Modo online: guardar directo en Supabase
      await this.syncTourToCloud(tourId, tourData, floorPlans, hotspots);
      
      // Cachear localmente
      await hybridStorage.saveTour(
        tourId,
        tourData.title || 'Sin nombre',
        tourData,
        floorPlans,
        hotspots
      );

      SyncEvents.notifyDataChanged('virtual_tours', 'update', tourId);
      
    } else {
      // Modo offline: guardar local y marcar pendiente
      await this.saveLocal(tourId, tourData, floorPlans, hotspots);
      SyncEvents.notifyDataChanged('virtual_tours', 'update', tourId);
    }
  }

  /**
   * Guardar solo localmente con marca de pendiente
   */
  async saveLocal(
    tourId: string,
    tourData: Tour,
    floorPlans: FloorPlan[] = [],
    hotspots: Hotspot[] = []
  ): Promise<void> {
    await hybridStorage.saveTour(
      tourId,
      tourData.title || 'Sin nombre',
      tourData,
      floorPlans,
      hotspots
    );

    // Marcar como pendiente de sync
    const metadataKey = `tour_metadata_${tourId}`;
    const metadata = JSON.parse(localStorage.getItem(metadataKey) || '{}');
    metadata.hasLocalChanges = true;
    metadata.lastModified = new Date().toISOString();
    localStorage.setItem(metadataKey, JSON.stringify(metadata));
  }

  /**
   * Sincronizar tour a la nube (limpiando metadatos internos)
   */
  async syncTourToCloud(
    tourId: string,
    tourData: Tour,
    floorPlans: FloorPlan[] = [],
    hotspots: Hotspot[] = []
  ): Promise<void> {
    // Limpiar metadatos internos antes de subir
    const cleanTour = this.cleanMetadata(tourData);

    // Upsert tour
    const { error: tourError } = await supabase
      .from('virtual_tours')
      .upsert({
        ...cleanTour,
        updated_at: new Date().toISOString()
      } as any);

    if (tourError) throw tourError;

    // Upsert floor plans
    if (floorPlans.length > 0) {
      const cleanFloorPlans = floorPlans.map(fp => this.cleanMetadata(fp));
      const { error: fpError } = await supabase
        .from('floor_plans')
        .upsert(cleanFloorPlans as any); // Cast necesario por campos opcionales

      if (fpError) throw fpError;
    }

    // Upsert hotspots
    if (hotspots.length > 0) {
      const cleanHotspots = hotspots.map(hs => this.cleanMetadata(hs));
      const { error: hsError } = await supabase
        .from('hotspots')
        .upsert(cleanHotspots as any); // Cast necesario por campos opcionales

      if (hsError) throw hsError;
    }

    // Marcar como sincronizado
    await hybridStorage.markTourSynced(tourId);

    console.log(`✅ Tour ${tourId} sincronizado a la nube`);
  }

  /**
   * Limpiar metadatos internos antes de sincronizar
   */
  private cleanMetadata<T extends Record<string, any>>(data: T): T {
    const clean = { ...data };
    
    // Eliminar propiedades internas
    delete (clean as any)._syncStatus;
    delete (clean as any)._lastModified;
    delete (clean as any)._deleted;
    delete (clean as any).cachedAt;
    delete (clean as any)._compressed;
    delete (clean as any).hasLocalChanges;
    delete (clean as any).lastSyncedAt;

    return clean;
  }

  /**
   * Cargar tour (intenta online primero, sino local)
   */
  async loadTour(tourId: string): Promise<{
    data: Tour;
    floorPlans: FloorPlan[];
    hotspots: Hotspot[];
  } | null> {
    // Intentar desde Supabase si está online
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('virtual_tours')
          .select(`
            *,
            floor_plans(*),
            floor_plans(hotspots(*))
          `)
          .eq('id', tourId)
          .single();

        if (!error && data) {
          // Cachear localmente
          await hybridStorage.saveTour(
            data.id,
            data.title,
            data as any,
            data.floor_plans || [],
            data.floor_plans?.flatMap((fp: any) => fp.hotspots || []) || []
          );

          return {
            data: data as any,
            floorPlans: data.floor_plans || [],
            hotspots: data.floor_plans?.flatMap((fp: any) => fp.hotspots || []) || []
          };
        }
      } catch (error) {
        console.warn('Error cargando desde Supabase, usando cache:', error);
      }
    }

    // Fallback a cache local
    const cached = await hybridStorage.loadTour(tourId);
    return cached ? {
      data: cached.data as Tour,
      floorPlans: cached.floorPlans as FloorPlan[],
      hotspots: cached.hotspots as Hotspot[]
    } : null;
  }

  /**
   * Listar todos los tours
   */
  async listTours() {
    return await hybridStorage.listTours();
  }

  /**
   * Eliminar tour
   */
  async deleteTour(tourId: string, syncImmediately = false): Promise<void> {
    if (navigator.onLine && syncImmediately) {
      // Eliminar de Supabase
      const { error } = await supabase
        .from('virtual_tours')
        .delete()
        .eq('id', tourId);

      if (error) throw error;
    }

    // Eliminar del cache local
    await hybridStorage.deleteTour(tourId);

    SyncEvents.notifyDataChanged('virtual_tours', 'delete', tourId);
  }

  /**
   * Crear tour offline
   */
  async createTourOffline(tourData: {
    title: string;
    description: string;
    coverImageUrl?: string;
    tourType: 'tour_360' | 'photo_tour';
    tenantId: string;
  }): Promise<PendingTour> {
    const pending = await hybridStorage.createTourOffline(tourData);
    SyncEvents.notifyDataChanged('virtual_tours', 'insert', pending.id);
    return pending;
  }

  /**
   * Obtener tours pendientes de sync
   */
  getPendingTours(): PendingTour[] {
    return hybridStorage.getPendingTours();
  }

  /**
   * Obtener estadísticas de almacenamiento
   */
  async getStats() {
    return await hybridStorage.getStats();
  }
}

export const dbService = new DatabaseService();
