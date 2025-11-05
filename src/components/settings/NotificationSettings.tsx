import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Bell, Mail, Clock, Loader2 } from 'lucide-react';

export const NotificationSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    email_on_new_view: true,
    email_on_new_user: true,
    email_weekly_report: true,
    push_on_new_view: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          ...settings
        });

      if (error) throw error;

      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async (type: 'new_view' | 'weekly_report') => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user?.id)
        .single();

      if (!profile) {
        toast.error('No se pudo obtener tu información de perfil');
        return;
      }

      toast.info('Enviando email de prueba...');

      const testData = type === 'new_view' 
        ? {
            notification_type: 'new_view',
            recipient_email: profile.email,
            recipient_name: profile.full_name || 'Usuario',
            data: {
              tour_title: 'Tour de Ejemplo',
              tour_id: 'test-id',
              viewed_at: new Date().toISOString(),
              user_id: user?.id
            }
          }
        : {
            notification_type: 'weekly_report',
            recipient_email: profile.email,
            recipient_name: profile.full_name || 'Usuario',
            data: {
              user_id: user?.id,
              stats: {
                total_views: 42,
                unique_visitors: 28,
                top_tours: [
                  { title: 'Tour Principal', views: 25 },
                  { title: 'Tour Secundario', views: 17 }
                ]
              }
            }
          };

      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: testData
      });

      if (error) throw error;

      toast.success('¡Email de prueba enviado! Revisa tu bandeja de entrada');
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error('Error al enviar email de prueba: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Notificaciones</CardTitle>
        <CardDescription>
          Gestiona cómo y cuándo recibes notificaciones
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            Los emails se envían a tu dirección de registro. Puedes probar las notificaciones usando los botones de prueba.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">Notificaciones por Email</h3>
          </div>
          
          <div className="space-y-4 pl-7">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-new-view" className="flex flex-col gap-1 cursor-pointer flex-1">
                  <span>Nuevas vistas en tours</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    Recibe un email cuando alguien vea tus tours
                  </span>
                </Label>
                <Switch
                  id="email-new-view"
                  checked={settings.email_on_new_view}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, email_on_new_view: checked })
                  }
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => testEmail('new_view')}
                className="w-fit"
              >
                <Mail className="mr-2 h-4 w-4" />
                Probar Email
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="email-new-user" className="flex flex-col gap-1 cursor-pointer flex-1">
                <span>Nuevos usuarios registrados</span>
                <span className="font-normal text-sm text-muted-foreground">
                  Notificaciones sobre nuevos registros
                </span>
              </Label>
              <Switch
                id="email-new-user"
                checked={settings.email_on_new_user}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, email_on_new_user: checked })
                }
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-weekly" className="flex flex-col gap-1 cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <span>Reporte semanal</span>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="font-normal text-sm text-muted-foreground">
                    Resumen de actividad cada lunes a las 9 AM
                  </span>
                </Label>
                <Switch
                  id="email-weekly"
                  checked={settings.email_weekly_report}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, email_weekly_report: checked })
                  }
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => testEmail('weekly_report')}
                className="w-fit"
              >
                <Mail className="mr-2 h-4 w-4" />
                Probar Reporte
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">Notificaciones Push</h3>
          </div>
          
          <div className="space-y-4 pl-7">
            <div className="flex items-center justify-between">
              <Label htmlFor="push-new-view" className="flex flex-col gap-1 cursor-pointer flex-1">
                <span>Nuevas vistas</span>
                <span className="font-normal text-sm text-muted-foreground">
                  Notificaciones en tiempo real en la aplicación
                </span>
              </Label>
              <Switch
                id="push-new-view"
                checked={settings.push_on_new_view}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, push_on_new_view: checked })
                }
              />
            </div>
          </div>
        </div>

        <Button 
          onClick={saveSettings} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar Configuración'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
