import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface EnhancedAnalytics {
  totalTours: number;
  publishedTours: number;
  draftTours: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  unreadComments: number;
  totalNotifications: number;
  unreadNotifications: number;
  totalEmailsSent: number;
  emailSuccessRate: number;
  emailsToday: number;
}

export const useEnhancedAnalytics = () => {
  const { currentTenant } = useTenant();
  const [analytics, setAnalytics] = useState<EnhancedAnalytics>({
    totalTours: 0,
    publishedTours: 0,
    draftTours: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    unreadComments: 0,
    totalNotifications: 0,
    unreadNotifications: 0,
    totalEmailsSent: 0,
    emailSuccessRate: 0,
    emailsToday: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get tours
      const { data: tours } = await (supabase
        .from('virtual_tours')
        .select('id, is_published')
        .eq('tenant_id', currentTenant.tenant_id) as any);

      const totalTours = tours?.length || 0;
      const publishedTours = tours?.filter(t => t.is_published).length || 0;
      const draftTours = totalTours - publishedTours;

      // Get analytics data
      const { data: analyticsData } = await supabase
        .from('tour_analytics')
        .select('views_count, likes_count, comments_count')
        .in('tour_id', tours?.map(t => t.id) || []);

      const totalViews = analyticsData?.reduce((sum, a) => sum + (a.views_count || 0), 0) || 0;
      const totalLikes = analyticsData?.reduce((sum, a) => sum + (a.likes_count || 0), 0) || 0;
      const totalComments = analyticsData?.reduce((sum, a) => sum + (a.comments_count || 0), 0) || 0;

      // Get unread comments
      const { data: comments } = await supabase
        .from('tour_comments')
        .select('id, is_read')
        .in('tour_id', tours?.map(t => t.id) || [])
        .eq('is_read', false);

      const unreadComments = comments?.length || 0;

      // Get notifications for tenant owner
      const { data: tenantData } = await supabase
        .from('tenants' as any)
        .select('owner_id')
        .eq('id', currentTenant.tenant_id)
        .maybeSingle();

      const { data: notifications } = await supabase
        .from('notifications')
        .select('id, read')
        .eq('user_id', (tenantData as any)?.owner_id);

      const totalNotifications = notifications?.length || 0;
      const unreadNotifications = notifications?.filter(n => !n.read).length || 0;

      // Get email logs
      const { data: emailLogs } = await supabase
        .from('email_logs')
        .select('status, sent_at')
        .eq('user_id', (tenantData as any)?.owner_id);

      const totalEmailsSent = emailLogs?.length || 0;
      const successCount = emailLogs?.filter(l => l.status === 'sent').length || 0;
      const emailSuccessRate = totalEmailsSent > 0 ? Math.round((successCount / totalEmailsSent) * 100) : 0;

      // Count emails sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const emailsToday = emailLogs?.filter(l => new Date(l.sent_at) >= today).length || 0;

      setAnalytics({
        totalTours,
        publishedTours,
        draftTours,
        totalViews,
        totalLikes,
        totalComments,
        unreadComments,
        totalNotifications,
        unreadNotifications,
        totalEmailsSent,
        emailSuccessRate,
        emailsToday,
      });
    } catch (error) {
      console.error('Error loading enhanced analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();

    // Subscribe to real-time updates
    if (!currentTenant) return;

    const channels = [
      // Tours updates
      supabase
        .channel('virtual_tours_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'virtual_tours'
          },
          () => loadAnalytics()
        )
        .subscribe(),

      // Analytics updates
      supabase
        .channel('tour_analytics_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tour_analytics'
          },
          () => loadAnalytics()
        )
        .subscribe(),

      // Comments updates
      supabase
        .channel('tour_comments_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tour_comments'
          },
          () => loadAnalytics()
        )
        .subscribe(),

      // Notifications updates
      supabase
        .channel('notifications_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications'
          },
          () => loadAnalytics()
        )
        .subscribe(),

      // Email logs updates
      supabase
        .channel('email_logs_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'email_logs'
          },
          () => loadAnalytics()
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentTenant]);

  return {
    analytics,
    loading,
    refresh: loadAnalytics,
  };
};
