import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EmailLog {
  id: string;
  notification_type: string;
  email_address: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  metadata: any;
}

interface EmailStats {
  totalSent: number;
  successRate: number;
  sentToday: number;
  recentLogs: EmailLog[];
}

export const useEmailLogs = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<EmailStats>({
    totalSent: 0,
    successRate: 0,
    sentToday: 0,
    recentLogs: [],
  });
  const [loading, setLoading] = useState(true);

  const loadEmailLogs = async () => {
    if (!user) return;

    try {
      const { data: logs, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const totalSent = logs?.length || 0;
      const successCount = logs?.filter(l => l.status === 'sent').length || 0;
      const successRate = totalSent > 0 ? Math.round((successCount / totalSent) * 100) : 0;

      // Count emails sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sentToday = logs?.filter(l => new Date(l.sent_at) >= today).length || 0;

      setStats({
        totalSent,
        successRate,
        sentToday,
        recentLogs: logs?.slice(0, 10) || [],
      });
    } catch (error) {
      console.error('Error loading email logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAllEmailLogs = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('email_logs')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setStats({
        totalSent: 0,
        successRate: 0,
        sentToday: 0,
        recentLogs: [],
      });
    } catch (error) {
      console.error('Error deleting email logs:', error);
    }
  };

  useEffect(() => {
    loadEmailLogs();

    // Subscribe to real-time email log updates
    if (!user) return;

    const channel = supabase
      .channel('email_logs_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_logs',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadEmailLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    stats,
    loading,
    deleteAllEmailLogs,
    refresh: loadEmailLogs,
  };
};
