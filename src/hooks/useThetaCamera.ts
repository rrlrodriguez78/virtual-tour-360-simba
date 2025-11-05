import { useState, useRef, useCallback } from 'react';
import { ThetaAPI } from '@/utils/thetaAPI';
import { toast } from 'sonner';

interface ThetaCameraState {
  isConnected: boolean;
  isConnecting: boolean;
  isCapturing: boolean;
  sessionId: string | null;
  error: string | null;
  batteryLevel: number | null;
}

export const useThetaCamera = () => {
  const [state, setState] = useState<ThetaCameraState>({
    isConnected: false,
    isConnecting: false,
    isCapturing: false,
    sessionId: null,
    error: null,
    batteryLevel: null,
  });

  const thetaAPI = useRef(new ThetaAPI());

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      // 1. Verificar conexión
      toast.info('Verificando conexión con Theta Z1...', { duration: 2000 });
      const isReachable = await thetaAPI.current.checkConnection();
      
      if (!isReachable) {
        throw new Error(
          'No se puede conectar con la cámara Theta Z1. ' +
          'Verifica que:\n' +
          '1. La cámara esté encendida\n' +
          '2. Estés conectado al WiFi de la cámara (THETAXXX)\n' +
          '3. No tengas VPN activa'
        );
      }

      // 2. Obtener info del dispositivo
      const deviceInfo = await thetaAPI.current.getDeviceInfo();
      console.log('Theta device info:', deviceInfo);
      
      // 3. Iniciar sesión
      toast.info('Iniciando sesión...', { duration: 2000 });
      const sessionId = await thetaAPI.current.startSession();
      
      // 4. Obtener estado de la cámara
      const cameraState = await thetaAPI.current.getState();
      
      setState(prev => ({
        ...prev,
        isConnected: true,
        sessionId,
        batteryLevel: cameraState.state.batteryLevel,
      }));
      
      toast.success(
        `Conectado a ${deviceInfo.model} (Batería: ${cameraState.state.batteryLevel}%)`
      );
    } catch (err: any) {
      console.error('Error conectando con Theta:', err);
      setState(prev => ({ ...prev, error: err.message }));
      toast.error(err.message);
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (state.sessionId) {
      try {
        await thetaAPI.current.closeSession(state.sessionId);
      } catch (err) {
        console.error('Error closing session:', err);
      }
    }
    
    setState({
      isConnected: false,
      isConnecting: false,
      isCapturing: false,
      sessionId: null,
      error: null,
      batteryLevel: null,
    });
    
    toast.info('Desconectado de Theta Z1');
  }, [state.sessionId]);

  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!state.sessionId) {
      toast.error('No hay sesión activa');
      return null;
    }
    
    setState(prev => ({ ...prev, isCapturing: true, error: null }));
    
    try {
      // 1. Capturar foto
      toast.info('📸 Capturando foto 360°...', { duration: 3000 });
      const fileUrl = await thetaAPI.current.takePicture(state.sessionId);
      
      // 2. Descargar imagen
      toast.info('⬇️ Descargando imagen...', { duration: 2000 });
      const blob = await thetaAPI.current.downloadImage(fileUrl);
      
      // 3. Actualizar batería
      const cameraState = await thetaAPI.current.getState();
      setState(prev => ({ ...prev, batteryLevel: cameraState.state.batteryLevel }));
      
      toast.success('✅ Foto capturada exitosamente');
      return blob;
    } catch (err: any) {
      console.error('Error capturando foto:', err);
      const errorMsg = err.message || 'Error desconocido al capturar';
      setState(prev => ({ ...prev, error: errorMsg }));
      toast.error(`Error: ${errorMsg}`);
      return null;
    } finally {
      setState(prev => ({ ...prev, isCapturing: false }));
    }
  }, [state.sessionId]);

  const refreshState = useCallback(async () => {
    if (!state.isConnected) return;
    
    try {
      const cameraState = await thetaAPI.current.getState();
      setState(prev => ({ ...prev, batteryLevel: cameraState.state.batteryLevel }));
    } catch (err) {
      console.error('Error refreshing camera state:', err);
    }
  }, [state.isConnected]);

  return {
    ...state,
    connect,
    disconnect,
    capturePhoto,
    refreshState,
  };
};
