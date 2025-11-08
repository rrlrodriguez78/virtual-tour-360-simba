import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { useNativeGeolocation } from '@/hooks/useNativeGeolocation';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';
import { useNativeStorage } from '@/hooks/useNativeStorage';
import { useNativeDevice } from '@/hooks/useNativeDevice';
import { 
  Camera, 
  MapPin, 
  Bell, 
  Database, 
  Smartphone, 
  Wifi, 
  WifiOff,
  Battery,
  Vibrate
} from 'lucide-react';
import { toast } from 'sonner';

const NativeFeatures = () => {
  const camera = useNativeCamera();
  const geolocation = useNativeGeolocation();
  const pushNotifications = useNativePushNotifications();
  const storage = useNativeStorage();
  const device = useNativeDevice();

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [storageTest, setStorageTest] = useState<string>('');

  const handleTakePicture = async () => {
    const result = await camera.takePicture();
    if (result?.dataUrl) {
      setCapturedImage(result.dataUrl);
      toast.success('Foto capturada exitosamente');
    }
  };

  const handleGetLocation = async () => {
    const position = await geolocation.getCurrentPosition();
    if (position) {
      toast.success(
        `Ubicación obtenida: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
      );
    }
  };

  const handleInitPushNotifications = async () => {
    await pushNotifications.initialize();
  };

  const handleSaveToStorage = async () => {
    const testData = { 
      timestamp: new Date().toISOString(),
      message: 'Datos de prueba guardados' 
    };
    const success = await storage.setItem('test_key', testData);
    if (success) {
      toast.success('Datos guardados en almacenamiento local');
    }
  };

  const handleLoadFromStorage = async () => {
    const data = await storage.getItem('test_key');
    if (data) {
      setStorageTest(JSON.stringify(data, null, 2));
      toast.success('Datos cargados desde almacenamiento');
    } else {
      toast.info('No hay datos guardados');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <h1 className="text-4xl font-bold mb-2">Funcionalidades Nativas</h1>
        <p className="text-muted-foreground mb-8">
          Prueba las capacidades nativas de la app
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Camera */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Cámara
              </CardTitle>
              <CardDescription>
                Captura fotos usando la cámara nativa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleTakePicture} disabled={camera.loading}>
                  {camera.loading ? 'Abriendo...' : 'Tomar Foto'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    const result = await camera.pickFromGallery();
                    if (result?.dataUrl) setCapturedImage(result.dataUrl);
                  }}
                  disabled={camera.loading}
                >
                  Galería
                </Button>
              </div>
              {capturedImage && (
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
            </CardContent>
          </Card>

          {/* Geolocation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Geolocalización
              </CardTitle>
              <CardDescription>
                Obtén la ubicación actual del dispositivo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleGetLocation} disabled={geolocation.loading}>
                {geolocation.loading ? 'Obteniendo...' : 'Obtener Ubicación'}
              </Button>
              {geolocation.position && (
                <div className="text-sm space-y-1">
                  <p><strong>Latitud:</strong> {geolocation.position.coords.latitude.toFixed(6)}</p>
                  <p><strong>Longitud:</strong> {geolocation.position.coords.longitude.toFixed(6)}</p>
                  <p><strong>Precisión:</strong> {geolocation.position.coords.accuracy.toFixed(2)}m</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Push Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notificaciones Push
              </CardTitle>
              <CardDescription>
                Recibe notificaciones push nativas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleInitPushNotifications}
                disabled={pushNotifications.initialized}
              >
                {pushNotifications.initialized ? 'Activadas ✓' : 'Activar Notificaciones'}
              </Button>
              {pushNotifications.token && (
                <div className="text-sm">
                  <p className="font-semibold mb-1">Token FCM:</p>
                  <p className="text-muted-foreground break-all text-xs">
                    {pushNotifications.token.substring(0, 50)}...
                  </p>
                </div>
              )}
              {pushNotifications.notifications.length > 0 && (
                <div className="text-sm">
                  <p className="font-semibold">Notificaciones recibidas: {pushNotifications.notifications.length}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Local Storage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Almacenamiento Local
              </CardTitle>
              <CardDescription>
                Guarda datos localmente en el dispositivo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleSaveToStorage} disabled={storage.loading}>
                  Guardar Datos
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleLoadFromStorage}
                  disabled={storage.loading}
                >
                  Cargar Datos
                </Button>
              </div>
              {storageTest && (
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
                  {storageTest}
                </pre>
              )}
            </CardContent>
          </Card>

          {/* Device Info */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Información del Dispositivo
              </CardTitle>
              <CardDescription>
                Información sobre el dispositivo y conexión
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    Dispositivo
                  </h4>
                  {device.deviceInfo && (
                    <div className="text-sm space-y-1">
                      <p><strong>Modelo:</strong> {device.deviceInfo.model}</p>
                      <p><strong>Plataforma:</strong> {device.deviceInfo.platform}</p>
                      <p><strong>Sistema:</strong> {device.deviceInfo.operatingSystem} {device.deviceInfo.osVersion}</p>
                      <p><strong>Fabricante:</strong> {device.deviceInfo.manufacturer}</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    {device.isOnline ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-500" />
                    )}
                    Conexión
                  </h4>
                  {device.networkStatus && (
                    <div className="text-sm space-y-1">
                      <p><strong>Estado:</strong> {device.isOnline ? 'Online' : 'Offline'}</p>
                      <p><strong>Tipo:</strong> {device.connectionType}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <Vibrate className="w-4 h-4" />
                  Vibración Háptica
                </h4>
                <div className="flex gap-2">
                  <Button size="sm" onClick={device.vibrateLight}>
                    Ligera
                  </Button>
                  <Button size="sm" onClick={device.vibrateMedium}>
                    Media
                  </Button>
                  <Button size="sm" onClick={device.vibrateHeavy}>
                    Fuerte
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NativeFeatures;
