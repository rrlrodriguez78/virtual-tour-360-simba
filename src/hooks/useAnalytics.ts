import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface TourAnalytics {
  tour_id: string;
  tour_title: string;
  total_views: number;
  unique_viewers: number;
  avg_duration_seconds: number;
  recent_views: number;
}

export interface AnalyticsSummary {
  total_tours: number;
  total_views: number;
  total_unique_viewers: number;
  views_today: number;
  views_this_week: number;
  views_this_month: number;
}

export const useAnalytics = () => {
  const { currentTenant } = useTenant();
  const [tourAnalytics, setTourAnalytics] = useState<TourAnalytics[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>({
    total_tours: 0,
    total_views: 0,
    total_unique_viewers: 0,
    views_today: 0,
    views_this_week: 0,
    views_this_month: 0
  });
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }

    try {
      // Get tours
      const tours: any = (await supabase
        .from('virtual_tours')
        .select('id, title')
        .eq('tenant_id', currentTenant.tenant_id)).data;

      if (!tours || tours.length === 0) {
        setLoading(false);
        return;
      }

      const tourIds = tours.map(t => t.id);

      // Get analytics summary for each tour
      const { data: analyticsData } = await supabase
        .from('analytics_summary')
        .select('*')
        .in('tour_id', tourIds);

      // Aggregate by tour
      const tourStats: Record<string, TourAnalytics> = {};
      
      tours.forEach(tour => {
        tourStats[tour.id] = {
          tour_id: tour.id,
          tour_title: tour.title,
          total_views: 0,
          unique_viewers: 0,
          avg_duration_seconds: 0,
          recent_views: 0
        };
      });

      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      let totalViews = 0;
      let totalUniqueViewers = 0;
      let viewsToday = 0;
      let viewsThisWeek = 0;
      let viewsThisMonth = 0;

      analyticsData?.forEach(stat => {
        const statDate = new Date(stat.date);
        const isToday = statDate.toDateString() === today.toDateString();
        const isThisWeek = statDate >= weekAgo;
        const isThisMonth = statDate >= monthAgo;

        if (tourStats[stat.tour_id]) {
          tourStats[stat.tour_id].total_views += stat.total_views;
          tourStats[stat.tour_id].unique_viewers += stat.unique_viewers;
          
          if (isToday || isThisWeek) {
            tourStats[stat.tour_id].recent_views += stat.total_views;
          }
        }

        totalViews += stat.total_views;
        totalUniqueViewers += stat.unique_viewers;

        if (isToday) viewsToday += stat.total_views;
        if (isThisWeek) viewsThisWeek += stat.total_views;
        if (isThisMonth) viewsThisMonth += stat.total_views;
      });

      setTourAnalytics(Object.values(tourStats));
      setSummary({
        total_tours: tours.length,
        total_views: totalViews,
        total_unique_viewers: totalUniqueViewers,
        views_today: viewsToday,
        views_this_week: viewsThisWeek,
        views_this_month: viewsThisMonth
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [currentTenant]);

  return {
    tourAnalytics,
    summary,
    loading,
    refresh: loadAnalytics
  };
};
