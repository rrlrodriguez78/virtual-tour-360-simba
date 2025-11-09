import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useIsInIframePreview } from '@/hooks/useIsInIframePreview';
import { AllTenantsStats } from '@/components/analytics/AllTenantsStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Trash2, Edit, Plus, Flag, ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { WorkflowGuide } from '@/components/admin/WorkflowGuide';
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

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  account_status: string;
  created_at: string;
  is_super_admin?: boolean;
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isSuperAdmin, loading: adminLoading } = useIsSuperAdmin();
  const isInIframePreview = useIsInIframePreview();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTenantDialog, setShowTenantDialog] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantForm, setTenantForm] = useState({ name: '', status: 'active', subscription_tier: 'free' });
  
  // Super Admin Management
  const [superAdmins, setSuperAdmins] = useState<UserProfile[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<UserProfile[]>([]);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [confirmationText, setConfirmationText] = useState('');

  useEffect(() => {
    if (!adminLoading && !isSuperAdmin && user && !isInIframePreview) {
      navigate('/app/inicio');
    }
  }, [isSuperAdmin, adminLoading, user, navigate, isInIframePreview]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadTenants();
      loadSuperAdmins();
      loadApprovedUsers();
    }
  }, [isSuperAdmin]);

  const loadTenants = async () => {
    try {
      // Optimized query with tenant user counts
      const { data, error } = await supabase
        .from('tenants' as any)
        .select(`
          *,
          tenant_users(count)
        `)
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

  const loadSuperAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          account_status,
          created_at,
          user_roles!inner(role)
        `)
        .eq('user_roles.role', 'admin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuperAdmins((data as any) || []);
    } catch (error) {
      console.error('Error loading super admins:', error);
      toast.error('Error al cargar Super Admins');
    }
  };

  const loadApprovedUsers = async () => {
    try {
      // Get all approved users
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, account_status, created_at')
        .eq('account_status', 'approved')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Get super admin user IDs
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      const adminIds = new Set((adminRoles || []).map(r => r.user_id));
      
      // Filter out super admins
      const nonAdminUsers = (allUsers || []).filter(u => !adminIds.has(u.id));
      setApprovedUsers(nonAdminUsers);
    } catch (error) {
      console.error('Error loading approved users:', error);
      toast.error('Error al cargar usuarios aprobados');
    }
  };

  const handlePromoteToSuperAdmin = async () => {
    if (!selectedUser || confirmationText !== 'PROMOVER') {
      toast.error('Escribe "PROMOVER" para confirmar');
      return;
    }

    try {
      const { error } = await supabase.rpc('promote_to_super_admin', {
        _user_id: selectedUser.id,
        _promoted_by: user!.id
      });

      if (error) throw error;

      toast.success(`${selectedUser.full_name} ha sido promovido a Super Admin`);
      setShowPromoteDialog(false);
      setSelectedUser(null);
      setConfirmationText('');
      loadSuperAdmins();
      loadApprovedUsers();
    } catch (error: any) {
      console.error('Error promoting user:', error);
      toast.error(error.message || 'Error al promover usuario');
    }
  };

  const handleRevokeSuperAdmin = async () => {
    if (!selectedUser || confirmationText !== 'REVOCAR') {
      toast.error('Escribe "REVOCAR" para confirmar');
      return;
    }

    try {
      const { error } = await supabase.rpc('revoke_super_admin', {
        _user_id: selectedUser.id,
        _revoked_by: user!.id
      });

      if (error) throw error;

      toast.success(`Privilegios de Super Admin revocados para ${selectedUser.full_name}`);
      setShowRevokeDialog(false);
      setSelectedUser(null);
      setConfirmationText('');
      loadSuperAdmins();
      loadApprovedUsers();
    } catch (error: any) {
      console.error('Error revoking super admin:', error);
      toast.error(error.message || 'Error al revocar privilegios');
    }
  };

  const openPromoteDialog = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setConfirmationText('');
    setShowPromoteDialog(true);
  };

  const openRevokeDialog = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setConfirmationText('');
    setShowRevokeDialog(true);
  };

  if (adminLoading || loading) {
    return <div className="p-8">Cargando...</div>;
  }

  if (!isSuperAdmin && !isInIframePreview) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Building2 className="h-8 w-8" />
                Super Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Gestiona todos los tenants del sistema • {tenants.length} organizaciones
              </p>
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
        </div>

        <WorkflowGuide variant="super-admin" />

        {/* System Statistics */}
        <AllTenantsStats />

        <Tabs defaultValue="tenants" className="w-full">
          <TabsList>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="super-admins">
              <Shield className="w-4 h-4 mr-2" />
              Super Admins
            </TabsTrigger>
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
                      <StatusBadge status={tenant.status as any} />
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

          <TabsContent value="super-admins" className="space-y-6">
            {/* Current Super Admins */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Super Admins Actuales ({superAdmins.length})
                </CardTitle>
                <CardDescription>
                  Usuarios con acceso completo al sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {superAdmins.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{admin.full_name}</div>
                        <div className="text-sm text-muted-foreground">{admin.email}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Desde: {new Date(admin.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Super Admin</Badge>
                        {superAdmins.length > 1 && admin.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRevokeDialog(admin)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Promote Users to Super Admin */}
            <Card>
              <CardHeader>
                <CardTitle>Promover Usuario a Super Admin</CardTitle>
                <CardDescription>
                  Selecciona un usuario aprobado para darle privilegios de Super Admin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {approvedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay usuarios aprobados disponibles para promover
                    </p>
                  ) : (
                    approvedUsers.map((userProfile) => (
                      <div key={userProfile.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">{userProfile.full_name}</div>
                          <div className="text-sm text-muted-foreground">{userProfile.email}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Registrado: {new Date(userProfile.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openPromoteDialog(userProfile)}
                          className="gap-2"
                        >
                          <Shield className="w-4 h-4" />
                          Promover
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
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

        {/* Promote Dialog */}
        <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Promover a Super Admin
              </DialogTitle>
              <DialogDescription>
                Esta es una acción crítica de seguridad. El usuario tendrá acceso completo al sistema.
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium">{selectedUser.full_name}</div>
                  <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-promote">
                    Escribe <span className="font-bold">PROMOVER</span> para confirmar
                  </Label>
                  <Input
                    id="confirm-promote"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="PROMOVER"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPromoteDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handlePromoteToSuperAdmin}
                disabled={confirmationText !== 'PROMOVER'}
              >
                Confirmar Promoción
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revoke Dialog */}
        <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Revocar Privilegios de Super Admin
              </DialogTitle>
              <DialogDescription>
                Esta acción eliminará todos los privilegios de Super Admin del usuario.
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="font-medium">{selectedUser.full_name}</div>
                  <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-revoke">
                    Escribe <span className="font-bold">REVOCAR</span> para confirmar
                  </Label>
                  <Input
                    id="confirm-revoke"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="REVOCAR"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={handleRevokeSuperAdmin}
                disabled={confirmationText !== 'REVOCAR'}
              >
                Confirmar Revocación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
