import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface TourComment {
  id: string;
  tour_id: string;
  commenter_name: string | null;
  commenter_email: string | null;
  comment_text: string;
  is_read: boolean;
  created_at: string;
}

export const useComments = () => {
  const { currentTenant } = useTenant();
  const [comments, setComments] = useState<TourComment[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadComments = async () => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }

    try {
      // Get tours
      const tourQuery = await (supabase.from('virtual_tours') as any)
        .select('id')
        .eq('tenant_id', currentTenant.tenant_id);
      const tours = tourQuery.data;

      if (!tours || tours.length === 0) {
        setLoading(false);
        return;
      }

      // Get comments
      const { data, error } = await supabase
        .from('tour_comments')
        .select('*')
        .in('tour_id', tours.map(t => t.id))
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setComments(data || []);
      setUnreadCount(data?.filter(c => !c.is_read).length || 0);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('tour_comments')
        .update({ is_read: true })
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev =>
        prev.map(c => c.id === commentId ? { ...c, is_read: true } : c)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking comment as read:', error);
    }
  };

  const deleteAllComments = async () => {
    if (!currentTenant) return;

    try {
      // Get tours
      const tourQuery = await (supabase.from('virtual_tours') as any)
        .select('id')
        .eq('tenant_id', currentTenant.tenant_id);
      const tours = tourQuery.data;

      if (!tours || tours.length === 0) return;

      // Delete all comments for user's tours
      const { error } = await supabase
        .from('tour_comments')
        .delete()
        .in('tour_id', tours.map(t => t.id));

      if (error) throw error;

      setComments([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error deleting comments:', error);
    }
  };

  useEffect(() => {
    loadComments();

    // Subscribe to new comments
    if (currentTenant) {
      const channel = supabase
        .channel('tour_comments')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tour_comments',
          },
          () => {
            loadComments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentTenant]);

  return {
    comments,
    unreadCount,
    loading,
    markAsRead,
    deleteAllComments,
    refresh: loadComments,
  };
};
