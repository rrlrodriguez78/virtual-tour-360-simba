import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { Activity, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export const DistributionPieChart = () => {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [data, setData] = useState({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadDistributionData = async () => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get tours
      const tourQuery = await (supabase.from('virtual_tours') as any)
        .select('id')
        .eq('tenant_id', currentTenant.tenant_id);
      const tours = tourQuery.data;

      if (!tours || tours.length === 0) {
        setLoading(false);
        return;
      }

      // Get analytics data
      const { data: analyticsData } = await supabase
        .from('tour_analytics')
        .select('views_count, likes_count, comments_count')
        .in('tour_id', tours.map(t => t.id));

      const views = analyticsData?.reduce((sum, a) => sum + (a.views_count || 0), 0) || 0;
      const likes = analyticsData?.reduce((sum, a) => sum + (a.likes_count || 0), 0) || 0;
      const comments = analyticsData?.reduce((sum, a) => sum + (a.comments_count || 0), 0) || 0;

      setData({
        views,
        likes,
        comments,
        shares: 0,
      });
    } catch (error) {
      console.error('Error loading distribution data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDistributionData();

    // Subscribe to real-time updates
    if (!currentTenant) return;

    const channels = [
      // Tour analytics updates
      supabase
        .channel('tour_analytics_distribution')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tour_analytics'
          },
          () => loadDistributionData()
        )
        .subscribe(),

      // Tour views updates
      supabase
        .channel('tour_views_distribution')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tour_views'
          },
          () => loadDistributionData()
        )
        .subscribe(),

      // Tour comments updates
      supabase
        .channel('tour_comments_distribution')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tour_comments'
          },
          () => loadDistributionData()
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentTenant]);

  const chartData = [
    { name: 'Views', value: data.views },
    { name: 'Likes', value: data.likes },
    { name: 'Comments', value: data.comments },
    { name: 'Shares', value: data.shares },
  ].filter(item => item.value > 0);

  const total = data.views + data.likes + data.comments + data.shares;

  const handleReset = () => {
    loadDistributionData();
  };

  return (
    <Card className="p-6 border-2 border-secondary/20 bg-gradient-to-br from-background to-secondary/5 backdrop-blur-sm h-full">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold font-futuristic flex items-center gap-2">
            <Activity className="w-5 h-5 text-secondary" />
            Activity Distribution
          </h3>
          <p className="text-sm text-muted-foreground mt-1 font-body-future">
            Engagement breakdown
          </p>
        </div>
        {total > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            {t('inicio.reset')}
          </Button>
        )}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      ) : total > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              animationDuration={1000}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontFamily: 'Exo 2',
              }}
            />
            <Legend 
              wrapperStyle={{
                fontFamily: 'Exo 2',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-72 flex items-center justify-center">
          <p className="text-muted-foreground">No activity data yet</p>
        </div>
      )}
    </Card>
  );
};
