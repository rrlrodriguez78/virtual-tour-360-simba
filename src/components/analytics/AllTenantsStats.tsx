import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, MapPin, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SystemStatistics {
  totalTenants: number;
  totalUsers: number;
  totalTours: number;
  totalViews: number;
  activeTenants: number;
  premiumTenants: number;
}

export function AllTenantsStats() {
  const [stats, setStats] = useState<SystemStatistics>({
    totalTenants: 0,
    totalUsers: 0,
    totalTours: 0,
    totalViews: 0,
    activeTenants: 0,
    premiumTenants: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Load tenants count
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('id, status, subscription_tier');

      const activeTenants = tenantsData?.filter(t => t.status === 'active').length || 0;
      const premiumTenants = tenantsData?.filter(t => 
        t.subscription_tier === 'premium' || t.subscription_tier === 'enterprise'
      ).length || 0;

      // Load users count
      const { count: usersCount } = await supabase
        .from('tenant_users')
        .select('*', { count: 'exact', head: true });

      // Load tours count
      const { count: toursCount } = await supabase
        .from('virtual_tours')
        .select('*', { count: 'exact', head: true });

      // Load views count
      const { count: viewsCount } = await supabase
        .from('tour_views')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalTenants: tenantsData?.length || 0,
        totalUsers: usersCount || 0,
        totalTours: toursCount || 0,
        totalViews: viewsCount || 0,
        activeTenants,
        premiumTenants,
      });
    } catch (error) {
      console.error('Error loading system stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Estadísticas del Sistema</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardDescription>Tenants Totales</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Building2 className="w-6 h-6 text-purple-500" />
              {stats.totalTenants}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.activeTenants} activos · {stats.premiumTenants} premium
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription>Usuarios Totales</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-500" />
              {stats.totalUsers}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              En todos los tenants
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription>Tours Totales</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <MapPin className="w-6 h-6 text-green-500" />
              {stats.totalTours}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              En todo el sistema
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 md:col-span-2 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardDescription>Vistas Totales</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Eye className="w-6 h-6 text-orange-500" />
              {stats.totalViews}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Todas las vistas del sistema
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}