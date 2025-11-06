import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';

/**
 * Componente de desarrollo para cambiar entre vistas Web y Android
 * Se muestra solo cuando NO hay Capacitor instalado (modo desarrollo en Lovable)
 */
export const PlatformPreviewSwitcher = () => {
  const { platform, isNative } = usePlatform();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Solo mostrar si NO estamos en Capacitor (modo desarrollo)
    setIsVisible(!isNative);
  }, [isNative]);

  if (!isVisible) return null;

  const switchPlatform = (targetPlatform: 'web' | 'android') => {
    const url = new URL(window.location.href);
    if (targetPlatform === 'web') {
      url.searchParams.delete('platform');
    } else {
      url.searchParams.set('platform', targetPlatform);
    }
    window.location.href = url.toString();
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-card border border-border rounded-lg shadow-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-muted-foreground">Vista Previa:</span>
        <Badge variant={platform === 'web' ? 'default' : 'secondary'}>
          {platform === 'web' ? 'Web' : 'Android'}
        </Badge>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={platform === 'web' ? 'default' : 'outline'}
          onClick={() => switchPlatform('web')}
          className="gap-2"
        >
          <Monitor className="w-4 h-4" />
          Web
        </Button>
        <Button
          size="sm"
          variant={platform === 'android' ? 'default' : 'outline'}
          onClick={() => switchPlatform('android')}
          className="gap-2"
        >
          <Smartphone className="w-4 h-4" />
          Android
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Cambia la interfaz sin Capacitor
      </p>
    </div>
  );
};
