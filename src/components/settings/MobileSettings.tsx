import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Smartphone, Wifi, WifiOff, Battery, HardDrive, Vibrate } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';
import { useNativeDevice } from '@/hooks/useNativeDevice';
import { useNativeStorage } from '@/hooks/useNativeStorage';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface MobileSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

export const MobileSettings = ({ settings, onUpdate }: MobileSettingsProps) => {
  const { deviceInfo, networkStatus, isOnline, vibrateLight, vibrateMedium, vibrateHeavy } = useNativeDevice();
  const { keys: storageKeys } = useNativeStorage();
  const [storageItemsCount, setStorageItemsCount] = useState(0);

  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        const allKeys = await storageKeys();
        setStorageItemsCount(allKeys.length);
      } catch (error) {
        console.error('Error loading storage info:', error);
      }
    };
    
    loadStorageInfo();
  }, []);

  const handleVibrateTest = async (type: 'light' | 'medium' | 'heavy') => {
    try {
      if (type === 'light') await vibrateLight();
      else if (type === 'medium') await vibrateMedium();
      else await vibrateHeavy();
      toast.success(`Vibración ${type} activada`);
    } catch (error) {
      toast.error('Error al activar vibración');
    }
  };

  return (
    <div className="space-y-6">
      {/* Device Information Card */}
      {deviceInfo && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle>Información del Dispositivo</CardTitle>
            </div>
            <CardDescription>Detalles de tu dispositivo Android</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Modelo</Label>
                <p className="text-sm font-medium">{deviceInfo.model || 'Desconocido'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Plataforma</Label>
                <p className="text-sm font-medium">{deviceInfo.platform || 'Web'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sistema Operativo</Label>
                <p className="text-sm font-medium">{deviceInfo.operatingSystem || 'Unknown'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Versión OS</Label>
                <p className="text-sm font-medium">{deviceInfo.osVersion || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fabricante</Label>
                <p className="text-sm font-medium">{deviceInfo.manufacturer || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Es Virtual</Label>
                <Badge variant={deviceInfo.isVirtual ? "secondary" : "default"}>
                  {deviceInfo.isVirtual ? 'Emulador' : 'Dispositivo Real'}
                </Badge>
              </div>
            </div>

            {/* Network Status */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <Label className="text-sm font-medium">Estado de Red</Label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge variant={isOnline ? "default" : "destructive"}>
                    {isOnline ? 'Online' : 'Offline'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <Badge variant="secondary">
                    {networkStatus?.connectionType || 'Unknown'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Storage Info */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Almacenamiento Local Nativo</Label>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Items almacenados</span>
                  <Badge>{storageItemsCount}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Haptic Feedback Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Vibrate className="h-5 w-5 text-primary" />
            <CardTitle>Vibración Háptica</CardTitle>
          </div>
          <CardDescription>Prueba diferentes intensidades de vibración</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Button 
              variant="outline" 
              onClick={() => handleVibrateTest('light')}
              className="w-full"
            >
              <Vibrate className="h-4 w-4 mr-2" />
              Suave
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleVibrateTest('medium')}
              className="w-full"
            >
              <Vibrate className="h-4 w-4 mr-2" />
              Medio
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleVibrateTest('heavy')}
              className="w-full"
            >
              <Vibrate className="h-4 w-4 mr-2" />
              Fuerte
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Optimization Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <CardTitle>Optimización Móvil</CardTitle>
          </div>
          <CardDescription>Ajusta la calidad y uso de datos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="image_quality">Calidad de Imagen</Label>
              <Select 
                value={settings.image_quality} 
                onValueChange={(value) => onUpdate({ image_quality: value as any })}
              >
                <SelectTrigger id="image_quality" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="data_usage">Uso de Datos</Label>
              <Select 
                value={settings.data_usage} 
                onValueChange={(value) => onUpdate({ data_usage: value as any })}
              >
                <SelectTrigger id="data_usage" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Bajo (Ahorrar Datos)</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="high">Alto (Mejor Calidad)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Descargas Automáticas</Label>
              <p className="text-xs text-muted-foreground">
                Descargar contenido de tours automáticamente
              </p>
            </div>
            <Switch
              checked={settings.auto_downloads}
              onCheckedChange={(checked) => onUpdate({ auto_downloads: checked })}
            />
          </div>

          <div>
            <Label>Límite de Almacenamiento Local (MB)</Label>
            <div className="flex items-center gap-4 mt-2">
              <Slider
                value={[settings.local_storage_limit_mb]}
                onValueChange={([value]) => onUpdate({ local_storage_limit_mb: value })}
                min={100}
                max={2000}
                step={100}
                className="flex-1"
              />
              <span className="text-sm font-medium w-16 text-right">
                {settings.local_storage_limit_mb} MB
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Máximo almacenamiento para contenido en caché
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
