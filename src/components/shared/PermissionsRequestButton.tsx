import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, XCircle } from "lucide-react";
import { requestPermissionsFromUI, isNativeApp } from "@/utils/storagePermissions";
import { useToast } from "@/hooks/use-toast";

export function PermissionsRequestButton() {
  const [isRequesting, setIsRequesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const { toast } = useToast();

  // Solo mostrar en apps nativas
  if (!isNativeApp()) {
    return null;
  }

  const handleRequestPermissions = async () => {
    setIsRequesting(true);
    setStatus('idle');

    try {
      const granted = await requestPermissionsFromUI();
      
      if (granted) {
        setStatus('granted');
        toast({
          title: "✅ Permisos concedidos",
          description: "La app puede acceder al almacenamiento del dispositivo",
          duration: 3000,
        });
      } else {
        setStatus('denied');
        toast({
          title: "⚠️ Permisos denegados",
          description: "Ve a Configuración > Aplicaciones > VirtualTour360 > Permisos",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      setStatus('denied');
      toast({
        title: "❌ Error",
        description: "No se pudieron solicitar los permisos",
        variant: "destructive",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Button
      onClick={handleRequestPermissions}
      disabled={isRequesting || status === 'granted'}
      variant={status === 'granted' ? 'outline' : 'default'}
      className="gap-2"
    >
      {status === 'idle' && <Shield className="h-4 w-4" />}
      {status === 'granted' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
      {status === 'denied' && <XCircle className="h-4 w-4 text-red-500" />}
      
      {isRequesting && 'Solicitando...'}
      {!isRequesting && status === 'idle' && 'Solicitar Permisos de Almacenamiento'}
      {!isRequesting && status === 'granted' && 'Permisos Concedidos'}
      {!isRequesting && status === 'denied' && 'Permisos Denegados'}
    </Button>
  );
}
