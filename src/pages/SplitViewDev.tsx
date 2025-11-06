import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Columns, Monitor, Smartphone, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function SplitViewDev() {
  const [mobileWidth, setMobileWidth] = useState(() => {
    const saved = localStorage.getItem('splitViewMobileWidth');
    return saved ? parseInt(saved) : 375;
  });

  const [currentRoute, setCurrentRoute] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('route') || '/app/tours';
  });

  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());

  // Solicitar ruta actual al cargar y sincronización con ventana principal
  useEffect(() => {
    const channel = new BroadcastChannel('split-view-sync');
    
    // Solicitar ruta actual inmediatamente
    channel.postMessage({
      type: 'REQUEST_CURRENT_ROUTE'
    });
    
    channel.onmessage = (event) => {
      if (event.data.type === 'ROUTE_CHANGE') {
        setCurrentRoute(event.data.route);
        setIsConnected(true);
        setLastSyncTime(Date.now());
      } else if (event.data.type === 'CURRENT_ROUTE_RESPONSE') {
        setCurrentRoute(event.data.route);
        setIsConnected(true);
        setLastSyncTime(Date.now());
      }
    };

    // Marcar como conectado después de recibir primer mensaje
    const timeout = setTimeout(() => {
      setIsConnected(true);
    }, 500);

    return () => {
      channel.close();
      clearTimeout(timeout);
    };
  }, []);

  // Detectar desconexión si no hay mensajes por 5 segundos
  useEffect(() => {
    const checkConnection = setInterval(() => {
      if (Date.now() - lastSyncTime > 5000) {
        setIsConnected(false);
      }
    }, 1000);

    return () => clearInterval(checkConnection);
  }, [lastSyncTime]);

  const handleResync = () => {
    const channel = new BroadcastChannel('split-view-sync');
    channel.postMessage({
      type: 'REQUEST_CURRENT_ROUTE'
    });
    channel.close();
  };

  // Persistir cambios de ancho móvil
  useEffect(() => {
    localStorage.setItem('splitViewMobileWidth', mobileWidth.toString());
  }, [mobileWidth]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header con controles */}
      <div className="border-b p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant="outline" className="gap-2">
            <Columns className="w-4 h-4" />
            Vista Dividida Dev
          </Badge>
          <Badge variant="secondary" className="max-w-xs truncate">
            {currentRoute}
          </Badge>
          <Badge variant={isConnected ? "default" : "destructive"} className="gap-2">
            {isConnected ? (
              <>
                <CheckCircle className="w-3 h-3" />
                Sincronizado
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                Desconectado
              </>
            )}
          </Badge>
          {!isConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResync}
              className="gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Re-sincronizar
            </Button>
          )}
        </div>

        {/* Controles de ancho móvil */}
        <div className="flex items-center gap-4 flex-wrap">
          <Label className="text-sm whitespace-nowrap">
            Ancho Móvil: {mobileWidth}px
          </Label>
          <Slider
            value={[mobileWidth]}
            onValueChange={([value]) => setMobileWidth(value)}
            min={320}
            max={480}
            step={5}
            className="w-48"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mobileWidth === 375 ? "default" : "outline"}
              onClick={() => setMobileWidth(375)}
            >
              iPhone
            </Button>
            <Button
              size="sm"
              variant={mobileWidth === 393 ? "default" : "outline"}
              onClick={() => setMobileWidth(393)}
            >
              Pixel
            </Button>
            <Button
              size="sm"
              variant={mobileWidth === 360 ? "default" : "outline"}
              onClick={() => setMobileWidth(360)}
            >
              Galaxy
            </Button>
            <Button
              size="sm"
              variant={mobileWidth === 414 ? "default" : "outline"}
              onClick={() => setMobileWidth(414)}
            >
              Plus
            </Button>
          </div>
        </div>
      </div>

      {/* Split Screen 50/50 */}
      <div className="flex-1 flex overflow-hidden">
        {/* LADO IZQUIERDO: Vista Desktop */}
        <div className="flex-1 border-r-2 border-primary/20 overflow-auto relative">
          <div className="sticky top-0 z-10 bg-primary/10 backdrop-blur px-4 py-2 border-b">
            <Badge variant="outline" className="gap-2">
              <Monitor className="w-3 h-3" />
              Vista Desktop
            </Badge>
          </div>
          <iframe
            src={`${currentRoute}${currentRoute.includes('?') ? '&' : '?'}iframe_preview=true`}
            className="w-full border-0"
            title="Vista Desktop"
            style={{ height: 'calc(100vh - 120px)' }}
          />
        </div>

        {/* LADO DERECHO: Vista Móvil */}
        <div className="flex-1 bg-muted/5 overflow-auto flex items-start justify-center p-6">
          <div className="sticky top-6">
            <div className="mb-3 flex items-center justify-center gap-2">
              <Badge variant="outline" className="gap-2">
                <Smartphone className="w-3 h-3" />
                Vista Móvil ({mobileWidth}px)
              </Badge>
            </div>
            
            {/* Device Frame */}
            <div 
              className="relative border-8 border-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden bg-white dark:bg-background"
              style={{ 
                width: `${mobileWidth}px`, 
                height: '90vh',
                maxHeight: '844px'
              }}
            >
              {/* Notch simulado */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-3xl z-10" />
              
              <iframe
                src={`${currentRoute}${currentRoute.includes('?') ? '&' : '?'}iframe_preview=true`}
                className="w-full h-full border-0"
                title="Vista Móvil"
                style={{ colorScheme: 'normal' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
