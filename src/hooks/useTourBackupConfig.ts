import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TourBackupConfig {
  id: string;
  tour_id: string;
  tenant_id: string;
  destination_id: string | null;
  auto_backup_enabled: boolean;
  backup_type: 'full_backup' | 'media_only';
  backup_on_create: boolean;
  backup_on_update: boolean;
  backup_frequency: 'immediate' | 'daily' | 'weekly';
  last_auto_backup_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useTourBackupConfig(tenantId: string) {
  const [configs, setConfigs] = useState<TourBackupConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_backup_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs((data || []) as TourBackupConfig[]);
    } catch (error) {
      console.error('Error loading tour backup configs:', error);
      toast.error('Error al cargar configuración de backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadConfigs();
    }
  }, [tenantId]);

  const enableAutoBackup = async (
    tourId: string,
    destinationId: string,
    options?: {
      backupType?: 'full_backup' | 'media_only';
      backupFrequency?: 'immediate' | 'daily' | 'weekly';
      backupOnCreate?: boolean;
      backupOnUpdate?: boolean;
    }
  ) => {
    try {
      const { data, error } = await supabase
        .from('tour_backup_config')
        .upsert(
          {
            tour_id: tourId,
            tenant_id: tenantId,
            destination_id: destinationId,
            auto_backup_enabled: true,
            backup_type: options?.backupType || 'full_backup',
            backup_frequency: options?.backupFrequency || 'immediate',
            backup_on_create: options?.backupOnCreate ?? true,
            backup_on_update: options?.backupOnUpdate ?? true,
          },
          { onConflict: 'tour_id,destination_id' }
        )
        .select()
        .single();

      if (error) throw error;

      toast.success('Backup automático habilitado');
      await loadConfigs();
      return data;
    } catch (error) {
      console.error('Error enabling auto backup:', error);
      toast.error('Error al habilitar backup automático');
      throw error;
    }
  };

  const disableAutoBackup = async (tourId: string) => {
    try {
      const { error } = await supabase
        .from('tour_backup_config')
        .update({ auto_backup_enabled: false })
        .eq('tour_id', tourId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast.success('Backup automático deshabilitado');
      await loadConfigs();
    } catch (error) {
      console.error('Error disabling auto backup:', error);
      toast.error('Error al deshabilitar backup automático');
      throw error;
    }
  };

  const updateConfig = async (
    tourId: string,
    updates: Partial<Omit<TourBackupConfig, 'id' | 'tour_id' | 'tenant_id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { error } = await supabase
        .from('tour_backup_config')
        .update(updates)
        .eq('tour_id', tourId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast.success('Configuración actualizada');
      await loadConfigs();
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Error al actualizar configuración');
      throw error;
    }
  };

  const deleteConfig = async (tourId: string) => {
    try {
      const { error } = await supabase
        .from('tour_backup_config')
        .delete()
        .eq('tour_id', tourId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast.success('Configuración eliminada');
      await loadConfigs();
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Error al eliminar configuración');
      throw error;
    }
  };

  const getConfigForTour = (tourId: string) => {
    return configs.find((c) => c.tour_id === tourId);
  };

  return {
    configs,
    loading,
    enableAutoBackup,
    disableAutoBackup,
    updateConfig,
    deleteConfig,
    getConfigForTour,
    refreshConfigs: loadConfigs,
  };
}
