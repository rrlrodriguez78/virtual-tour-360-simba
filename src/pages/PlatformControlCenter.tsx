import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, Monitor, Smartphone, GitBranch, Flag, Eye, 
  Layout, Palette, Code, Database, CheckCircle2, InfoIcon, ArrowLeft 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { usePlatformUIConfigs } from '@/hooks/usePlatformUIManagement';

export default function PlatformControlCenter() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useIsSuperAdmin();
  const { data: configs } = usePlatformUIConfigs();

  const phases = [
    {
      phase: 1,
      title: 'Configuración Base de Datos',
      description: 'Tabla platform_ui_config con RLS policies',
      status: 'completed',
      icon: Database,
      stats: { tables: 2, policies: 4 }
    },
    {
      phase: 2,
      title: 'Hooks y Lógica React',
      description: 'usePlatform, usePlatformConfig, usePlatformUIManagement',
      status: 'completed',
      icon: Code,
      stats: { hooks: 5, components: 3 }
    },
    {
      phase: 3,
      title: 'Componentes Duplicados',
      description: 'Dashboard.web.tsx y Dashboard.android.tsx',
      status: 'completed',
      icon: Layout,
      stats: { pages: 2, platforms: 2 }
    },
    {
      phase: 4,
      title: 'Editor Visual Avanzado',
      description: 'Editores visuales para layout y feature flags',
      status: 'completed',
      icon: Palette,
      stats: { editors: 3, features: 8 }
    },
    {
      phase: 5,
      title: 'Feature Flags y Versiones',
      description: 'Sistema de versiones, rollback y comparación',
      status: 'completed',
      icon: GitBranch,
      stats: { versions: configs?.length || 0, active: configs?.filter(c => c.is_active).length || 0 }
    }
  ];

  const quickActions = [
    {
      title: 'Platform UI Manager',
      description: 'Gestionar configuraciones de plataforma',
      icon: Settings,
      color: 'bg-blue-500',
      action: () => navigate('/app/platform-ui-manager')
    },
    {
      title: 'Ver Dashboard Web',
      description: 'Preview de Dashboard optimizado para web',
      icon: Monitor,
      color: 'bg-purple-500',
      action: () => navigate('/app/tours')
    },
    {
      title: 'Ver Dashboard Android',
      description: 'Preview de Dashboard optimizado para Android',
      icon: Smartphone,
      color: 'bg-green-500',
      action: () => navigate('/app/tours')
    },
    {
      title: 'Historial de Versiones',
      description: 'Ver y comparar versiones anteriores',
      icon: GitBranch,
      color: 'bg-orange-500',
      action: () => navigate('/app/platform-ui-manager')
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertDescription>
              Solo los super administradores pueden acceder a esta página.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Settings className="h-10 w-10" />
              Centro de Control Multiplatforma
            </h1>
          </div>
          <p className="text-muted-foreground text-lg pl-[52px]">
            Gestión centralizada del sistema de UI adaptativa para Web y Android
          </p>
        </div>

        <Alert className="mb-8">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Sistema Completo:</strong> Todas las 5 fases están implementadas y activas. 
            Usa esta página para controlar toda la experiencia multiplataforma.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">
              <Eye className="h-4 w-4 mr-2" />
              Resumen General
            </TabsTrigger>
            <TabsTrigger value="phases">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Estado de Fases
            </TabsTrigger>
            <TabsTrigger value="actions">
              <Settings className="h-4 w-4 mr-2" />
              Acciones Rápidas
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Configuraciones Activas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{configs?.filter(c => c.is_active).length || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    de {configs?.length || 0} totales
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Plataformas Soportadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">2</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Web y Android
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Páginas Configuradas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {new Set(configs?.map(c => c.page_name)).size || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    páginas únicas
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Sistema Implementado</CardTitle>
                <CardDescription>
                  Arquitectura completa de UI multiplataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Monitor className="h-8 w-8 text-blue-500" />
                    <div>
                      <div className="font-semibold">Web Platform</div>
                      <div className="text-sm text-muted-foreground">
                        Desktop optimizado con grid 3 columnas
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Smartphone className="h-8 w-8 text-green-500" />
                    <div>
                      <div className="font-semibold">Android Platform</div>
                      <div className="text-sm text-muted-foreground">
                        Móvil con gestos táctiles y FAB
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Phases Tab */}
          <TabsContent value="phases" className="space-y-4">
            {phases.map((phase) => {
              const Icon = phase.icon;
              return (
                <Card key={phase.phase}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">
                            Fase {phase.phase}: {phase.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {phase.description}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="default" className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {phase.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      {Object.entries(phase.stats).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground capitalize">{key}:</span>
                          <span className="font-semibold">{value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Quick Actions Tab */}
          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <Card key={idx} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={action.action}>
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${action.color} text-white`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{action.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {action.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        Abrir
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
