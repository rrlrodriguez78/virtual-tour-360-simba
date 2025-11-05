import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCheck, UserX, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface UserApprovalRequest {
  id: string;
  user_id: string;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  email: string;
  full_name: string | null;
}

export default function UserApprovals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isSuperAdmin, loading: adminLoading } = useIsSuperAdmin();
  const [requests, setRequests] = useState<UserApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'approve' | 'reject' | null;
    userId: string | null;
    userName: string | null;
  }>({ open: false, type: null, userId: null, userName: null });
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isSuperAdmin && user) {
      navigate('/app/inicio');
    }
  }, [isSuperAdmin, adminLoading, user, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadRequests();
    }
  }, [isSuperAdmin]);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('user_approval_requests')
        .select(`
          *,
          profiles!user_approval_requests_user_id_fkey (
            email,
            full_name
          )
        `)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((req: any) => ({
        ...req,
        email: req.profiles?.email || '',
        full_name: req.profiles?.full_name || null,
      }));

      setRequests(formatted);
    } catch (error) {
      console.error('Error loading approval requests:', error);
      toast.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!actionDialog.userId || !user) return;

    setProcessing(true);
    try {
      const { error } = await supabase.rpc('approve_user', {
        _user_id: actionDialog.userId,
        _approved_by: user.id,
        _notes: notes || null,
      });

      if (error) throw error;

      toast.success('Usuario aprobado exitosamente');
      setActionDialog({ open: false, type: null, userId: null, userName: null });
      setNotes('');
      loadRequests();
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Error al aprobar usuario');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!actionDialog.userId || !user) return;

    setProcessing(true);
    try {
      const { error } = await supabase.rpc('reject_user', {
        _user_id: actionDialog.userId,
        _rejected_by: user.id,
        _notes: notes || null,
      });

      if (error) throw error;

      toast.success('Usuario rechazado');
      setActionDialog({ open: false, type: null, userId: null, userName: null });
      setNotes('');
      loadRequests();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('Error al rechazar usuario');
    } finally {
      setProcessing(false);
    }
  };

  const openActionDialog = (type: 'approve' | 'reject', userId: string, userName: string | null) => {
    setActionDialog({ open: true, type, userId, userName });
    setNotes('');
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const rejectedRequests = requests.filter((r) => r.status === 'rejected');

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
              <UserCheck className="h-8 w-8" />
              Aprobación de Usuarios
            </h1>
            <p className="text-muted-foreground mt-2">
              Gestiona las solicitudes de registro de nuevos usuarios
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingRequests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aprobados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedRequests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rechazados</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rejectedRequests.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="pending">
              Pendientes ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Aprobados ({approvedRequests.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rechazados ({rejectedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No hay solicitudes pendientes</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingRequests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">
                            {request.full_name || 'Sin nombre'}
                          </CardTitle>
                          <CardDescription>{request.email}</CardDescription>
                          <p className="text-sm text-muted-foreground">
                            Solicitado: {new Date(request.requested_at).toLocaleString('es-ES')}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Pendiente
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openActionDialog('approve', request.user_id, request.full_name)}
                          className="flex-1"
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Aprobar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => openActionDialog('reject', request.user_id, request.full_name)}
                          className="flex-1"
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Rechazar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No hay usuarios aprobados</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {approvedRequests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">
                            {request.full_name || 'Sin nombre'}
                          </CardTitle>
                          <CardDescription>{request.email}</CardDescription>
                          <p className="text-sm text-muted-foreground">
                            Aprobado: {request.reviewed_at ? new Date(request.reviewed_at).toLocaleString('es-ES') : '-'}
                          </p>
                          {request.notes && (
                            <p className="text-sm text-muted-foreground mt-2">
                              <strong>Notas:</strong> {request.notes}
                            </p>
                          )}
                        </div>
                        <Badge className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Aprobado
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No hay usuarios rechazados</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {rejectedRequests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">
                            {request.full_name || 'Sin nombre'}
                          </CardTitle>
                          <CardDescription>{request.email}</CardDescription>
                          <p className="text-sm text-muted-foreground">
                            Rechazado: {request.reviewed_at ? new Date(request.reviewed_at).toLocaleString('es-ES') : '-'}
                          </p>
                          {request.notes && (
                            <p className="text-sm text-muted-foreground mt-2">
                              <strong>Notas:</strong> {request.notes}
                            </p>
                          )}
                        </div>
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Rechazado
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Action Dialog */}
        <AlertDialog open={actionDialog.open} onOpenChange={(open) => !processing && setActionDialog({ ...actionDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {actionDialog.type === 'approve' ? 'Aprobar Usuario' : 'Rechazar Usuario'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {actionDialog.type === 'approve'
                  ? `¿Estás seguro de que quieres aprobar a ${actionDialog.userName || 'este usuario'}? Se creará automáticamente su tenant y podrá acceder a la aplicación.`
                  : `¿Estás seguro de que quieres rechazar a ${actionDialog.userName || 'este usuario'}? No podrá acceder a la aplicación.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agrega un comentario sobre esta decisión..."
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={actionDialog.type === 'approve' ? handleApprove : handleReject}
                disabled={processing}
                className={actionDialog.type === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
              >
                {processing ? 'Procesando...' : (actionDialog.type === 'approve' ? 'Aprobar' : 'Rechazar')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
