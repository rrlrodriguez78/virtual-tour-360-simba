import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TourShare {
  id: string;
  tour_id: string;
  share_token: string;
  permission_level: 'view' | 'comment' | 'edit';
  expires_at: string | null;
  is_active: boolean;
  max_views: number | null;
  view_count: number;
  created_at: string;
}

export function useShareTour(tourId: string) {
  const [shares, setShares] = useState<TourShare[]>([]);
  const [loading, setLoading] = useState(false);

  const loadShares = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tour_shares')
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShares(data || []);
    } catch (error) {
      console.error('Error loading shares:', error);
      toast.error("Error al cargar los links compartidos");
    } finally {
      setLoading(false);
    }
  };

  const deactivateShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('tour_shares')
        .update({ is_active: false })
        .eq('id', shareId);

      if (error) throw error;
      
      toast.success("Link desactivado");
      loadShares();
    } catch (error) {
      console.error('Error deactivating share:', error);
      toast.error("Error al desactivar el link");
    }
  };

  const deleteShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('tour_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;
      
      toast.success("Link eliminado");
      loadShares();
    } catch (error) {
      console.error('Error deleting share:', error);
      toast.error("Error al eliminar el link");
    }
  };

  return {
    shares,
    loading,
    loadShares,
    deactivateShare,
    deleteShare,
  };
}