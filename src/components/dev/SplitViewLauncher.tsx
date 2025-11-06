import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Columns } from 'lucide-react';

export const SplitViewLauncher = () => {
  const location = useLocation();
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const windowRef = useRef<Window | null>(null);

  // Abrir ventana popup
  const openSplitView = () => {
    const currentRoute = location.pathname + location.search;
    
    // Configuración de la ventana popup
    const width = 1600;
    const height = 900;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
      'status=no'
    ].join(',');

    // Abrir ventana con ruta actual como parámetro
    windowRef.current = window.open(
      `/dev/split-view?route=${encodeURIComponent(currentRoute)}`,
      'SplitViewDev',
      features
    );

    if (windowRef.current) {
      setIsWindowOpen(true);
      windowRef.current.focus();

      // Detectar cuando se cierra la ventana
      const checkClosed = setInterval(() => {
        if (windowRef.current?.closed) {
          setIsWindowOpen(false);
          clearInterval(checkClosed);
        }
      }, 500);
    }
  };

  // Sincronizar navegación con ventana popup
  useEffect(() => {
    if (isWindowOpen && windowRef.current && !windowRef.current.closed) {
      const channel = new BroadcastChannel('split-view-sync');
      const currentRoute = location.pathname + location.search;
      
      channel.postMessage({
        type: 'ROUTE_CHANGE',
        route: currentRoute
      });

      channel.close();
    }
  }, [location, isWindowOpen]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (windowRef.current && !windowRef.current.closed) {
        windowRef.current.close();
      }
    };
  }, []);

  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Vista Dividida</Label>
        {isWindowOpen && (
          <Badge variant="secondary" className="text-xs">
            Ventana abierta
          </Badge>
        )}
      </div>
      
      <Button
        onClick={openSplitView}
        disabled={isWindowOpen}
        variant={isWindowOpen ? "secondary" : "default"}
        size="sm"
        className="w-full gap-2"
      >
        <Columns className="w-4 h-4" />
        {isWindowOpen ? 'Ventana Activa' : 'Abrir Vista Dividida'}
      </Button>

      {isWindowOpen && (
        <p className="text-xs text-muted-foreground">
          La vista dividida se abrió en una ventana separada
        </p>
      )}
    </div>
  );
};
