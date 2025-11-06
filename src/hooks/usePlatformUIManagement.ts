import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PlatformUIConfig {
  id: string;
  page_name: string;
  platform: 'web' | 'android' | 'both';
  is_active: boolean;
  component_path: string;
  layout_config: Record<string, any>;
  feature_flags: Record<string, any>;
  version: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export function usePlatformUIConfigs() {
  return useQuery({
    queryKey: ['platform-ui-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_ui_config')
        .select('*')
        .order('page_name', { ascending: true })
        .order('platform', { ascending: true });

      if (error) throw error;
      return data as PlatformUIConfig[];
    },
  });
}

export function useCreatePlatformUIConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Omit<PlatformUIConfig, 'id' | 'created_at' | 'updated_at' | 'version'>) => {
      const { data, error } = await supabase
        .from('platform_ui_config')
        .insert([config])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-ui-configs'] });
      toast({
        title: 'Configuración creada',
        description: 'La configuración de plataforma se ha creado exitosamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la configuración',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdatePlatformUIConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PlatformUIConfig> }) => {
      const { data, error } = await supabase
        .from('platform_ui_config')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-ui-configs'] });
      toast({
        title: 'Configuración actualizada',
        description: 'Los cambios se han guardado exitosamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la configuración',
        variant: 'destructive',
      });
    },
  });
}

export function useDeletePlatformUIConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_ui_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-ui-configs'] });
      toast({
        title: 'Configuración eliminada',
        description: 'La configuración se ha eliminado correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar la configuración',
        variant: 'destructive',
      });
    },
  });
}
