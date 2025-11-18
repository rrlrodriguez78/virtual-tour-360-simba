import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, Trash2, HardDrive, WifiOff, Wifi, RefreshCw, AlertCircle } from 'lucide-react';
import { useOfflineTours } from '@/hooks/useOfflineTours';
import { useTenant } from '@/contexts/TenantContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface Tour {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
}

export const OfflineTourManager = () => {
  const { currentTenant } = useTenant();
  const {
    isDownloading,
    isSyncing,
    downloadedTours,
    storageInfo,
    isOnline,
    downloadTour,
    syncLocalChanges,
    deleteTour,
    cleanOldTours,
    refreshTours
  } = useOfflineTours(currentTenant?.tenant_id);

  const [availableTours, setAvailableTours] = useState<Tour[]>([]);
  const [loadingTours, setLoadingTours] = useState(true);

  // Cargar tours disponibles del servidor
  useEffect(() => {
    const loadAvailableTours = async () => {
      if (!currentTenant) return;
      
      try {
        const { data, error } = await supabase
          .from('virtual_tours')
          .select('id, title, description, is_published')
          .eq('tenant_id', currentTenant.tenant_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAvailableTours(data || []);
      } catch (error) {
        console.error('Error loading tours:', error);
      } finally {
        setLoadingTours(false);
      }
    };

    loadAvailableTours();
  }, [currentTenant]);

  const handleDownloadTour = async (tourId: string) => {
    const success = await downloadTour(tourId);
    if (success) {
      await refreshTours();
    }
  };

  const handleSyncChanges = async () => {
    await syncLocalChanges();
  };

  const handleDeleteTour = async (tourId: string) => {
    if (confirm('¿Eliminar este tour del almacenamiento offline?')) {
      await deleteTour(tourId);
    }
  };

  const handleCleanOld = async () => {
    if (confirm('¿Eliminar tours descargados hace más de 30 días?')) {
      await cleanOldTours(30);
    }
  };

  const downloadedTourIds = new Set(downloadedTours.map(t => t.id));
  const modifiedCount = downloadedTours.filter(t => t.status === 'modified').length;

  return (
    <div className="space-y-6">
      {/* Estado de conexión y acciones globales */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-orange-500" />
              )}
              <CardTitle>Trabajo Offline</CardTitle>
            </div>
            <Badge variant={isOnline ? "default" : "secondary"}>
              {isOnline ? 'En línea' : 'Sin conexión'}
            </Badge>
          </div>
          <CardDescription>
            Descarga tours para trabajar sin conexión y sincroniza cuando tengas WiFi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estadísticas de almacenamiento */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Almacenamiento usado</p>
                <p className="text-xs text-muted-foreground">
                  {storageInfo.tours} tours • {storageInfo.sizeMB} MB
                </p>
              </div>
            </div>
            {modifiedCount > 0 && (
              <Badge variant="outline" className="bg-orange-500/10">
                {modifiedCount} cambio(s) sin sincronizar
              </Badge>
            )}
          </div>

          {/* Acciones globales */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleSyncChanges}
              disabled={!isOnline || isSyncing || modifiedCount === 0}
              variant="default"
              className="gap-2"
            >
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Sincronizar cambios
              {modifiedCount > 0 && ` (${modifiedCount})`}
            </Button>

            <Button
              onClick={handleCleanOld}
              variant="outline"
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar antiguos
            </Button>

            <Button
              onClick={refreshTours}
              variant="ghost"
              size="icon"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Alerta si no hay conexión */}
          {!isOnline && (
            <Alert>
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                Sin conexión a internet. Puedes seguir trabajando con tours descargados.
                Los cambios se sincronizarán cuando vuelvas a tener conexión.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tours descargados */}
      {downloadedTours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Tours Descargados ({downloadedTours.length})
            </CardTitle>
            <CardDescription>
              Tours disponibles para trabajo offline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {downloadedTours.map((tour) => (
                <div
                  key={tour.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{tour.title}</h4>
                      {tour.status === 'modified' && (
                        <Badge variant="outline" className="bg-orange-500/10">
                          Modificado
                        </Badge>
                      )}
                      {tour.status === 'syncing' && (
                        <Badge variant="outline" className="bg-blue-500/10">
                          Sincronizando...
                        </Badge>
                      )}
                      {tour.status === 'error' && (
                        <Badge variant="destructive">Error</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Descargado: {new Date(tour.downloadedAt).toLocaleDateString()}
                      {tour.localChanges.newPhotos > 0 && (
                        <> • {tour.localChanges.newPhotos} foto(s) nueva(s)</>
                      )}
                    </p>
                    {tour.syncError && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {tour.syncError}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => handleDeleteTour(tour.id)}
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tours disponibles para descargar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Descargar Tours
          </CardTitle>
          <CardDescription>
            Descarga tours del servidor para trabajar offline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTours ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando tours...
            </div>
          ) : availableTours.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay tours disponibles
            </div>
          ) : (
            <div className="space-y-2">
              {availableTours.map((tour) => {
                const isDownloaded = downloadedTourIds.has(tour.id);
                return (
                  <div
                    key={tour.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{tour.title}</h4>
                        {tour.is_published && (
                          <Badge variant="outline" className="text-xs">
                            Publicado
                          </Badge>
                        )}
                      </div>
                      {tour.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {tour.description}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => handleDownloadTour(tour.id)}
                      disabled={isDownloaded || isDownloading || !isOnline}
                      variant={isDownloaded ? "outline" : "default"}
                      size="sm"
                      className="gap-2"
                    >
                      {isDownloaded ? (
                        <>
                          <Download className="h-4 w-4" />
                          Descargado
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Descargar
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información sobre uso offline */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Cómo usar:</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Descarga tours cuando tengas WiFi</li>
            <li>Trabaja sin conexión: edita metadata y agrega fotos</li>
            <li>Los cambios se guardan localmente</li>
            <li>Sincroniza cuando vuelvas a tener conexión</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
};
