import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Navbar } from '@/components/Navbar';
import { 
  HardDrive, 
  Trash2, 
  RefreshCw, 
  Eye,
  Calendar,
  Image as ImageIcon,
  Layers,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Settings
} from 'lucide-react';
import { useHybridStorage } from '@/hooks/useHybridStorage';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Capacitor } from '@capacitor/core';
import { PermissionsRequestButton } from '@/components/shared/PermissionsRequestButton';

export default function OfflineCacheManager() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tourToDelete, setTourToDelete] = useState<string | null>(null);
  
  const { 
    stats,
    isNativeApp,
    hasPermission,
    usingNativeStorage,
    listTours,
    deleteTour,
    requestPermissions
  } = useHybridStorage();

  const [cachedTours, setCachedTours] = useState<Array<{
    id: string;
    name: string;
    size: number;
    lastModified: Date;
  }>>([]);

  const loadCacheData = async () => {
    setIsLoading(true);
    try {
      const tours = await listTours();
      setCachedTours(tours);
    } catch (error) {
      console.error('Error loading cache data:', error);
      toast.error('Error al cargar datos de caché');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCacheData();
  }, []);

  const handleDeleteTour = async (tourId: string) => {
    try {
      await deleteTour(tourId);
      toast.success('Tour eliminado del caché');
      await loadCacheData();
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error('Error al eliminar tour del caché');
    } finally {
      setTourToDelete(null);
    }
  };

  const handleOpenFolder = () => {
    if (Capacitor.isNativePlatform()) {
      toast.info('Abre el explorador de archivos en /VirtualTour360/', {
        description: 'Android: Mis archivos > VirtualTour360\niOS: Archivos > En mi iPhone > VirtualTour360'
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const cacheUsagePercentage = stats.limit > 0 ? (stats.size / stats.limit) * 100 : 0;
  const isNearLimit = cacheUsagePercentage >= 80;
  const isAtLimit = cacheUsagePercentage >= 95;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center justify-center h-[50vh]">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Cargando caché...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <HardDrive className="w-8 h-8" />
              Gestión de Almacenamiento Offline
            </h1>
            <p className="text-muted-foreground mt-2">
              {usingNativeStorage 
                ? 'Tours guardados en el almacenamiento nativo del dispositivo'
                : 'Tours guardados en IndexedDB del navegador'}
            </p>
          </div>
          
          <div className="flex gap-2">
            {usingNativeStorage && (
              <Button
                variant="outline"
                onClick={handleOpenFolder}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Abrir Carpeta
              </Button>
            )}
          </div>
        </div>

        {/* Permission Alert for Mobile */}
        {isNativeApp && !hasPermission && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3">
              <p>Se requieren permisos de almacenamiento para usar el modo offline completo</p>
              <PermissionsRequestButton />
            </AlertDescription>
          </Alert>
        )}

        {/* Storage Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {usingNativeStorage ? '📂' : '💾'}
              {usingNativeStorage ? 'Almacenamiento Nativo' : 'IndexedDB (Navegador)'}
              {!usingNativeStorage && isAtLimit && (
                <Badge variant="destructive">Lleno</Badge>
              )}
              {!usingNativeStorage && isNearLimit && !isAtLimit && (
                <Badge variant="secondary">Casi lleno</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {usingNativeStorage 
                ? `/VirtualTour360/ - Espacio real del dispositivo`
                : `Uso actual del caché local (${Math.round(cacheUsagePercentage)}% usado)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!usingNativeStorage && (isNearLimit || isAtLimit) && (
              <Alert variant={isAtLimit ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {isAtLimit 
                    ? 'Caché lleno. En móvil tendrás almacenamiento ilimitado.'
                    : 'Caché cerca del límite. Considera usar la app móvil para almacenamiento ilimitado.'
                  }
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Espacio usado</span>
              <span className="text-2xl font-bold">{formatBytes(stats.size)}</span>
            </div>
            
            {!usingNativeStorage && (
              <>
                <Progress 
                  value={cacheUsagePercentage} 
                  className={`h-3 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-yellow-500' : ''}`}
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Límite: {formatBytes(stats.limit)}</span>
                  <span>Disponible: {formatBytes(stats.limit - stats.size)}</span>
                </div>
              </>
            )}

            {usingNativeStorage && stats.availableSpace !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Espacio disponible en dispositivo:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatBytes(stats.availableSpace)}
                </span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{stats.count}</div>
                <div className="text-sm text-muted-foreground">Tours Guardados</div>
                {!usingNativeStorage && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Máx: 5
                  </div>
                )}
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{formatBytes(stats.size)}</div>
                <div className="text-sm text-muted-foreground">Espacio Total</div>
                {usingNativeStorage && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✅ Sin límites
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cached Tours List */}
        {cachedTours.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <HardDrive className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No hay tours en caché</h3>
              <p className="text-muted-foreground mb-6">
                Prepara tours para uso offline desde el Editor
              </p>
              <Button onClick={() => navigate('/app/tours')}>
                Ir a Mis Tours
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {cachedTours.map((cachedTour) => {
              return (
                <Card key={cachedTour.id} className="animate-fade-in">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-semibold">{cachedTour.name}</h3>
                          
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Disponible Offline
                          </Badge>
                          
                          {usingNativeStorage && (
                            <Badge variant="outline" className="gap-1">
                              📂 Almacenamiento Nativo
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <HardDrive className="w-4 h-4" />
                            <span>{formatBytes(cachedTour.size)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {formatDistanceToNow(cachedTour.lastModified, { 
                                addSuffix: true, 
                                locale: es 
                              })}
                            </span>
                          </div>
                          {usingNativeStorage && (
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Sin expiración</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/viewer/${cachedTour.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Abrir
                        </Button>
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setTourToDelete(cachedTour.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!tourToDelete} onOpenChange={(open) => !open && setTourToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar del caché?</AlertDialogTitle>
            <AlertDialogDescription>
              Este tour dejará de estar disponible sin conexión. Podrás volver a descargarlo cuando tengas internet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => tourToDelete && handleDeleteTour(tourToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
