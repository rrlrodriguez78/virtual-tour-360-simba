import { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, MapPin, Eye, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TenantStatistics {
  totalUsers: number;
  totalTours: number;
  publishedTours: number;
  totalViews: number;
  totalViewsLastMonth: number;
}

export function TenantStats() {
  const { currentTenant } = useTenant();
  const [stats, setStats] = useState<TenantStatistics>({
    totalUsers: 0,
    totalTours: 0,
    publishedTours: 0,
    totalViews: 0,
    totalViewsLastMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentTenant) {
      loadStats();
    }
  }, [currentTenant]);

  const loadStats = async () => {
    if (!currentTenant) return;

    try {
      // Load tenant users count
      const { count: usersCount } = await supabase
        .from('tenant_users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.tenant_id);

      // Load tours count
      const { data: toursData } = await supabase
        .from('virtual_tours')
        .select('id, is_published')
        .eq('tenant_id', currentTenant.tenant_id);

      const publishedCount = toursData?.filter(t => t.is_published).length || 0;

      // Load views count
      const tourIds = toursData?.map(t => t.id) || [];
      let totalViews = 0;
      let viewsLastMonth = 0;

      if (tourIds.length > 0) {
        const { count: viewsCount } = await supabase
          .from('tour_views')
          .select('*', { count: 'exact', head: true })
          .in('tour_id', tourIds);

        totalViews = viewsCount || 0;

        // Views in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { count: recentViewsCount } = await supabase
          .from('tour_views')
          .select('*', { count: 'exact', head: true })
          .in('tour_id', tourIds)
          .gte('viewed_at', thirtyDaysAgo.toISOString());

        viewsLastMonth = recentViewsCount || 0;
      }

      setStats({
        totalUsers: usersCount || 0,
        totalTours: toursData?.length || 0,
        publishedTours: publishedCount,
        totalViews,
        totalViewsLastMonth: viewsLastMonth,
      });
    } catch (error) {
      console.error('Error loading tenant stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentTenant) {
    return null;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Estadísticas de {currentTenant.tenant_name}</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription>Usuarios</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-500" />
              {stats.totalUsers}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Miembros del tenant
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardDescription>Tours</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <MapPin className="w-6 h-6 text-purple-500" />
              {stats.totalTours}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.publishedTours} publicados
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription>Vistas Totales</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Eye className="w-6 h-6 text-green-500" />
              {stats.totalViews}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Todas las vistas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardDescription>Últimos 30 días</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-orange-500" />
              {stats.totalViewsLastMonth}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Vistas recientes
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}