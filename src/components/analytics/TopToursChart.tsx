import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { Trophy, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

interface TourData {
  name: string;
  views: number;
  isPublished: boolean;
}

export const TopToursChart = () => {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [data, setData] = useState<TourData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopTours();

    // Subscribe to real-time analytics updates
    if (!currentTenant) return;

    const channels = [
      // Tour analytics updates
      supabase
        .channel('tour_analytics_top_tours')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tour_analytics'
          },
          () => loadTopTours()
        )
        .subscribe(),

      // Tour views updates
      supabase
        .channel('tour_views_top_tours')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tour_views'
          },
          () => loadTopTours()
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentTenant]);

  const loadTopTours = async () => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }

    try {
      // Get tours with analytics
      const tourQuery = await (supabase.from('virtual_tours') as any)
        .select(`
          id,
          title,
          is_published,
          tour_analytics (
            views_count
          )
        `)
        .eq('tenant_id', currentTenant.tenant_id)
        .limit(5);
      const tours = tourQuery.data;

      if (tours) {
        const formattedData = tours
          .map(tour => ({
            name: tour.title.length > 20 ? tour.title.substring(0, 20) + '...' : tour.title,
            views: (tour.tour_analytics as any)?.[0]?.views_count || 0,
            isPublished: tour.is_published,
          }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 5);

        setData(formattedData);
      }
    } catch (error) {
      console.error('Error loading top tours:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 border-2 border-accent/20 bg-gradient-to-br from-background to-accent/5 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold font-futuristic flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent" />
          {t('inicio.topTours')}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 font-body-future">
          Your most viewed virtual tours
        </p>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : data.length > 0 ? (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} layout="vertical">
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.8} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              type="number" 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px', fontFamily: 'Exo 2' }}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={150}
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px', fontFamily: 'Exo 2' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontFamily: 'Exo 2',
              }}
              formatter={(value: number) => [`${value} views`, 'Views']}
            />
            <Bar
              dataKey="views"
              fill="url(#barGradient)"
              radius={[0, 8, 8, 0]}
              animationDuration={1000}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-80 flex flex-col items-center justify-center gap-4">
          <Eye className="w-12 h-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No tour data available yet</p>
        </div>
      )}
    </Card>
  );
};
