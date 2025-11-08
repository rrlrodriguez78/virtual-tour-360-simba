import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { toast } from 'sonner';

export const useNativeCamera = () => {
  const [loading, setLoading] = useState(false);

  const takePicture = async () => {
    setLoading(true);
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });

      return {
        imageUrl: image.webPath,
        format: image.format,
        base64: image.base64String
      };
    } catch (error) {
      console.error('Error taking picture:', error);
      toast.error('Error al tomar la foto');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    setLoading(true);
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos
      });

      return {
        imageUrl: image.webPath,
        format: image.format,
        base64: image.base64String
      };
    } catch (error) {
      console.error('Error picking from gallery:', error);
      toast.error('Error al seleccionar imagen');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const permissions = await Camera.requestPermissions();
      return permissions.camera === 'granted';
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  };

  return {
    takePicture,
    pickFromGallery,
    requestPermissions,
    loading
  };
};
