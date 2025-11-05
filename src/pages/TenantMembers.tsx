import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Mail, Shield, User } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TenantMember {
  id: string;
  user_id: string;
  role: 'tenant_admin' | 'member';
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
}

export default function TenantMembers() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, isTenantAdmin, loading: tenantLoading } = useTenant();
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'tenant_admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && currentTenant) {
      if (!isTenantAdmin) {
        toast.error('No tienes permisos para acceder a esta página');
        navigate('/app/inicio');
        return;
      }
      loadMembers();
    }
  }, [user, currentTenant, isTenantAdmin]);

  const loadMembers = async () => {
    if (!currentTenant) return;

    try {
      // Get tenant users
      const { data: tenantUsers, error: usersError } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', currentTenant.tenant_id)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Get profiles for those users
      const userIds = tenantUsers?.map(u => u.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine data
      const membersData = tenantUsers?.map(tu => ({
        ...tu,
        profiles: profiles?.find(p => p.id === tu.user_id) || { email: '', full_name: null }
      })) || [];

      setMembers(membersData as TenantMember[]);
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Error al cargar los miembros');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !currentTenant) {
      toast.error('Por favor ingresa un email válido');
      return;
    }

    setInviting(true);
    try {
      // Check if user exists
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profiles) {
        toast.error('Usuario no encontrado. Debe registrarse primero.');
        return;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('tenant_users')
        .select('id')
        .eq('tenant_id', currentTenant.tenant_id)
        .eq('user_id', profiles.id)
        .maybeSingle();

      if (existing) {
        toast.error('Este usuario ya es miembro del tenant');
        return;
      }

      // Add member
      const { error: insertError } = await supabase
        .from('tenant_users')
        .insert({
          tenant_id: currentTenant.tenant_id,
          user_id: profiles.id,
          role: inviteRole,
        });

      if (insertError) throw insertError;

      toast.success('Miembro invitado exitosamente');
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('member');
      loadMembers();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error('Error al invitar miembro');
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteMember = async (memberId: string, userId: string) => {
    if (!currentTenant) return;

    // Prevent deleting the owner
    if (userId === currentTenant.tenant_id) {
      toast.error('No puedes eliminar al propietario del tenant');
      return;
    }

    try {
      const { error } = await supabase
        .from('tenant_users')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Miembro eliminado exitosamente');
      setMembers(members.filter(m => m.id !== memberId));
      setMemberToDelete(null);
    } catch (error) {
      console.error('Error deleting member:', error);
      toast.error('Error al eliminar miembro');
    }
  };

  if (authLoading || tenantLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Gestión de Miembros</h1>
            <p className="text-muted-foreground">
              Administra los usuarios con acceso a tu organización
            </p>
          </div>

          <Button size="lg" onClick={() => setInviteDialogOpen(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Invitar Miembro
          </Button>
        </div>

        {members.length === 0 ? (
          <Card className="p-12 text-center">
            <CardHeader>
              <CardTitle className="text-2xl">Sin miembros</CardTitle>
              <CardDescription>
                Invita usuarios para que puedan colaborar en tu organización
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setInviteDialogOpen(true)} size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Invitar Primer Miembro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Miembros ({members.length})</CardTitle>
              <CardDescription>
                Lista de todos los usuarios con acceso a este tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Fecha de ingreso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {member.profiles.full_name || 'Sin nombre'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {member.profiles.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'tenant_admin' ? 'default' : 'secondary'}>
                          {member.role === 'tenant_admin' ? (
                            <>
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </>
                          ) : (
                            'Miembro'
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(member.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMemberToDelete(member.id)}
                          disabled={member.user_id === currentTenant?.tenant_id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Invite Dialog */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invitar Miembro</DialogTitle>
              <DialogDescription>
                Ingresa el email del usuario que quieres invitar. El usuario debe estar registrado en la plataforma.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email del usuario</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Miembro</SelectItem>
                    <SelectItem value="tenant_admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleInviteMember} disabled={inviting}>
                {inviting ? 'Invitando...' : 'Invitar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el acceso de este usuario al tenant. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const member = members.find(m => m.id === memberToDelete);
                  if (member) {
                    handleDeleteMember(member.id, member.user_id);
                  }
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
