import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

interface ChartData {
  date: string;
  views: number;
}

export const ViewsChart = () => {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadViewsData = async () => {
    if (!currentTenant) {
      setData([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Get tour IDs for this tenant
      const tourQuery = await (supabase.from('virtual_tours') as any)
        .select('id')
        .eq('tenant_id', currentTenant.tenant_id);
      const tours = tourQuery.data;

      if (!tours || tours.length === 0) {
        setData([]);
        return;
      }

      const tourIds = tours.map(t => t.id);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      // Fetch views within the period
      const { data: views } = await supabase
        .from('tour_views')
        .select('viewed_at')
        .in('tour_id', tourIds)
        .gte('viewed_at', startDate.toISOString())
        .lte('viewed_at', endDate.toISOString())
        .order('viewed_at', { ascending: true });

      // Group views by date
      const viewsByDate: { [key: string]: number } = {};
      
      // Initialize all dates in range with 0
      for (let i = 0; i < period; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        viewsByDate[dateKey] = 0;
      }

      // Count views per date
      views?.forEach(view => {
        const date = new Date(view.viewed_at);
        const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (viewsByDate[dateKey] !== undefined) {
          viewsByDate[dateKey]++;
        }
      });

      // Convert to array format for chart
      const chartData = Object.entries(viewsByDate).map(([date, views]) => ({
        date,
        views
      }));

      setData(chartData);
    } catch (error) {
      console.error('Error loading views data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadViewsData();
  }, [period, currentTenant]);

  // Real-time subscription
  useEffect(() => {
    if (!currentTenant) return;

    const channel = supabase
      .channel('tour_views_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tour_views'
        },
        () => {
          // Reload data when new view is added
          loadViewsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant, period]);

  return (
    <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold font-futuristic flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {t('inicio.viewsLastMonth')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 font-body-future">
            Daily views over the selected period
          </p>
        </div>
        
        {/* Period Selector */}
        <div className="flex gap-2">
          <Button
            variant={period === 7 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(7)}
            className="font-body-future"
          >
            7d
          </Button>
          <Button
            variant={period === 30 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(30)}
            className="font-body-future"
          >
            30d
          </Button>
          <Button
            variant={period === 90 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(90)}
            className="font-body-future"
          >
            90d
          </Button>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px', fontFamily: 'Exo 2' }}
          />
          <YAxis 
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
          />
          <Area
            type="monotone"
            dataKey="views"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            fill="url(#viewsGradient)"
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};
