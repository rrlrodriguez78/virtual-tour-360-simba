import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { AllTenantsStats } from '@/components/analytics/AllTenantsStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Trash2, Edit, Plus, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Tenant {
  id: string;
  name: string;
  owner_id: string;
  status: string;
  subscription_tier: string;
  created_at: string;
}

interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isSuperAdmin, loading: adminLoading } = useIsSuperAdmin();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTenantDialog, setShowTenantDialog] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantForm, setTenantForm] = useState({ name: '', status: 'active', subscription_tier: 'free' });

  useEffect(() => {
    if (!adminLoading && !isSuperAdmin && user) {
      navigate('/app/inicio');
    }
  }, [isSuperAdmin, adminLoading, user, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadTenants();
    }
  }, [isSuperAdmin]);

  const loadTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants((data as any as Tenant[]) || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
      toast.error('Error al cargar tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!tenantForm.name) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      const { error } = await supabase
        .from('tenants' as any)
        .insert({
          name: tenantForm.name,
          owner_id: user!.id,
          status: tenantForm.status,
          subscription_tier: tenantForm.subscription_tier,
        });

      if (error) throw error;

      toast.success('Tenant creado exitosamente');
      setShowTenantDialog(false);
      setTenantForm({ name: '', status: 'active', subscription_tier: 'free' });
      loadTenants();
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast.error('Error al crear tenant');
    }
  };

  const handleUpdateTenant = async () => {
    if (!editingTenant) return;

    try {
      const { error } = await supabase
        .from('tenants' as any)
        .update({
          name: tenantForm.name,
          status: tenantForm.status,
          subscription_tier: tenantForm.subscription_tier,
        })
        .eq('id', editingTenant.id);

      if (error) throw error;

      toast.success('Tenant actualizado exitosamente');
      setShowTenantDialog(false);
      setEditingTenant(null);
      setTenantForm({ name: '', status: 'active', subscription_tier: 'free' });
      loadTenants();
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast.error('Error al actualizar tenant');
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm('¿Estás seguro de eliminar este tenant? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tenants' as any)
        .delete()
        .eq('id', tenantId);

      if (error) throw error;

      toast.success('Tenant eliminado exitosamente');
      loadTenants();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('Error al eliminar tenant');
    }
  };

  const openCreateDialog = () => {
    setEditingTenant(null);
    setTenantForm({ name: '', status: 'active', subscription_tier: 'free' });
    setShowTenantDialog(true);
  };

  const openEditDialog = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setTenantForm({
      name: tenant.name,
      status: tenant.status,
      subscription_tier: tenant.subscription_tier,
    });
    setShowTenantDialog(true);
  };

  if (adminLoading || loading) {
    return <div className="p-8">Cargando...</div>;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navbar />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Super Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">Gestiona todos los tenants del sistema</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/app/feature-management')}>
              <Flag className="h-4 w-4 mr-2" />
              Features
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tenant
            </Button>
          </div>
        </div>

        {/* System Statistics */}
        <AllTenantsStats />

        <Tabs defaultValue="tenants" className="w-full">
          <TabsList>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="stats">Estadísticas</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tenants.map((tenant) => (
                <Card key={tenant.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{tenant.name}</CardTitle>
                        <CardDescription className="mt-1">
                          Creado: {new Date(tenant.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                        {tenant.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Plan:</span>{' '}
                        <span className="font-medium">{tenant.subscription_tier}</span>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(tenant)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteTenant(tenant.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Total Tenants</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{tenants.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Tenants Activos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {tenants.filter((t) => t.status === 'active').length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Tenants Premium</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {tenants.filter((t) => t.subscription_tier !== 'free').length}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showTenantDialog} onOpenChange={setShowTenantDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTenant ? 'Editar Tenant' : 'Crear Nuevo Tenant'}
              </DialogTitle>
              <DialogDescription>
                {editingTenant
                  ? 'Actualiza la información del tenant'
                  : 'Crea un nuevo tenant en el sistema'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                  placeholder="Nombre del tenant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={tenantForm.status}
                  onValueChange={(value) => setTenantForm({ ...tenantForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Plan</Label>
                <Select
                  value={tenantForm.subscription_tier}
                  onValueChange={(value) =>
                    setTenantForm({ ...tenantForm, subscription_tier: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTenantDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={editingTenant ? handleUpdateTenant : handleCreateTenant}>
                {editingTenant ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
