import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Shield, Bell, AlertCircle, RefreshCw, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationsList } from '@/components/settings/NotificationsList';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { AnalyticsDashboard } from '@/components/settings/AnalyticsDashboard';
import { PWAUpdateSettings } from '@/components/settings/PWAUpdateSettings';

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useIsSuperAdmin();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  // Log access attempt
  useEffect(() => {
    const logAccess = async () => {
      if (authLoading || superAdminLoading || !user) return;

      const accessType = isSuperAdmin ? 'allowed' : 'denied';
      
      try {
        // Log access to database
        await supabase
          .from('settings_access_logs')
          .insert({
            user_id: user.id,
            access_type: accessType,
            ip_address: null,
            user_agent: navigator.userAgent
          });

        console.log('Settings access logged:', { accessType, userId: user.id });
      } catch (error) {
        console.error('Error in access logging:', error);
      }
    };

    logAccess();
  }, [user, authLoading, superAdminLoading, isSuperAdmin]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    // Redirect if not super admin
    if (!authLoading && !superAdminLoading && user && !isSuperAdmin) {
      toast.error('Access denied. This page is only accessible to super admins.');
      navigate('/app/tours');
    }
  }, [user, authLoading, isSuperAdmin, superAdminLoading, navigate]);

  useEffect(() => {
    if (user && isSuperAdmin) {
      setLoading(false);
    }
  }, [user, isSuperAdmin]);

  if (authLoading || superAdminLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Show access denied if not super admin
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don't have permission to access this page. Only super administrators can access settings.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            onClick={() => navigate('/app/tours')}
            className="mt-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/app/inicio')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('settings.backToDashboard')}
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">{t('settings.title')}</h1>
            <p className="text-muted-foreground">
              {t('settings.subtitle')}
            </p>
          </div>
        </div>

        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notificaciones
            </TabsTrigger>
            <TabsTrigger value="pwa">
              <RefreshCw className="w-4 h-4 mr-2" />
              PWA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Sistema de Notificaciones y Analytics</CardTitle>
                  <CardDescription>
                    Monitorea la actividad de tus tours, visualiza estadísticas y configura notificaciones
                  </CardDescription>
                </CardHeader>
              </Card>

              <Tabs defaultValue="notifications" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="notifications">
                    <Bell className="w-4 h-4 mr-2" />
                    Notificaciones
                  </TabsTrigger>
                  <TabsTrigger value="analytics">
                    <Shield className="w-4 h-4 mr-2" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="config">
                    <Terminal className="w-4 h-4 mr-2" />
                    Configuración
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="notifications">
                  <NotificationsList />
                </TabsContent>

                <TabsContent value="analytics">
                  <AnalyticsDashboard />
                </TabsContent>

                <TabsContent value="config">
                  <NotificationSettings />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="pwa">
            <PWAUpdateSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
