import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
  created_at: string;
}

export default function TenantAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentTenant, isTenantAdmin, loading: tenantLoading } = useTenant();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', role: 'user' });

  useEffect(() => {
    if (!tenantLoading && !isTenantAdmin && user) {
      toast.error('No tienes permisos de administrador');
      navigate('/app/inicio');
    }
  }, [isTenantAdmin, tenantLoading, user, navigate]);

  useEffect(() => {
    if (currentTenant && isTenantAdmin) {
      loadUsers();
    }
  }, [currentTenant, isTenantAdmin]);

  const loadUsers = async () => {
    if (!currentTenant) return;

    try {
      const { data: tenantUsers, error } = await supabase
        .from('tenant_users' as any)
        .select('*')
        .eq('tenant_id', currentTenant.tenant_id);

      if (error) throw error;

      // Load user profiles
      const userIds = (tenantUsers || []).map((tu: any) => tu.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const usersWithProfiles = (tenantUsers || []).map((tu: any) => {
        const profile = profiles?.find((p: any) => p.id === tu.user_id);
        return {
          ...tu,
          email: profile?.email,
          full_name: profile?.full_name,
        };
      }) as TenantUser[];

      setUsers(usersWithProfiles);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!currentTenant || !userForm.email) {
      toast.error('Email es requerido');
      return;
    }

    try {
      // Check if user exists
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', userForm.email)
        .single();

      if (!profiles) {
        toast.error('Usuario no encontrado. Debe registrarse primero.');
        return;
      }

      // Add user to tenant
      const { error } = await supabase.from('tenant_users' as any).insert({
        tenant_id: currentTenant.tenant_id,
        user_id: profiles.id,
        role: userForm.role as any,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Este usuario ya pertenece al tenant');
        } else {
          throw error;
        }
        return;
      }

      // Create notification for the new user
      await supabase.from('notifications').insert({
        user_id: profiles.id,
        type: 'tenant_invite',
        title: 'Agregado a nuevo tenant',
        message: `Has sido agregado al tenant "${currentTenant.tenant_name}" con rol ${userForm.role === 'tenant_admin' ? 'Administrador' : 'Miembro'}`,
        metadata: {
          tenant_id: currentTenant.tenant_id,
          tenant_name: currentTenant.tenant_name,
          role: userForm.role,
          invited_by: user?.id,
        },
      });

      toast.success('Usuario agregado exitosamente');
      setShowUserDialog(false);
      setUserForm({ email: '', role: 'user' });
      loadUsers();
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error('Error al agregar usuario');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!currentTenant) return;

    if (!confirm('¿Estás seguro de remover este usuario del tenant?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tenant_users' as any)
        .delete()
        .eq('tenant_id', currentTenant.tenant_id)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Usuario removido exitosamente');
      loadUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast.error('Error al remover usuario');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!currentTenant) return;

    try {
      const { error } = await supabase
        .from('tenant_users' as any)
        .update({ role: newRole as any })
        .eq('tenant_id', currentTenant.tenant_id)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Rol actualizado exitosamente');
      loadUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Error al actualizar rol');
    }
  };

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navbar />
        <div className="container mx-auto p-6">
          <Alert variant="destructive">
            <AlertTitle>No hay tenant seleccionado</AlertTitle>
            <AlertDescription>
              Por favor selecciona un tenant desde el menú superior.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!isTenantAdmin) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navbar />
        <div className="container mx-auto p-6">
          <Alert variant="destructive">
            <AlertTitle>Sin permisos de administrador</AlertTitle>
            <AlertDescription>
              No tienes permisos de administrador para este tenant.
              Rol actual: {currentTenant?.user_role || 'desconocido'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navbar />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Gestión de Usuarios
            </h1>
            <p className="text-muted-foreground mt-2">
              Administra los usuarios de{' '}
              <span className="font-semibold">{currentTenant?.tenant_name}</span>
            </p>
          </div>
          <Button onClick={() => setShowUserDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Agregar Usuario
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuarios del Tenant</CardTitle>
            <CardDescription>Lista de usuarios con acceso a este tenant</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha de Ingreso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((tenantUser) => (
                  <TableRow key={tenantUser.id}>
                    <TableCell className="font-medium">
                      {tenantUser.full_name || 'Sin nombre'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {tenantUser.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={tenantUser.role}
                        onValueChange={(value) => handleUpdateRole(tenantUser.user_id, value)}
                        disabled={tenantUser.user_id === user?.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="tenant_admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {new Date(tenantUser.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveUser(tenantUser.user_id)}
                        disabled={tenantUser.user_id === user?.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Usuario al Tenant</DialogTitle>
              <DialogDescription>
                Ingresa el email de un usuario registrado para agregarlo al tenant
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email del Usuario</Label>
                <Input
                  id="email"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="usuario@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(value) => setUserForm({ ...userForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="tenant_admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUserDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleInviteUser}>Agregar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
