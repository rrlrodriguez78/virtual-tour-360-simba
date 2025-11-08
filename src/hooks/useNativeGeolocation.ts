import { useState, useEffect } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';
import { toast } from 'sonner';

export const useNativeGeolocation = () => {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = async () => {
    setLoading(true);
    setError(null);
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
      setPosition(coordinates);
      return coordinates;
    } catch (error) {
      console.error('Error getting position:', error);
      const errorMsg = 'No se pudo obtener la ubicación';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const watchPosition = (callback: (position: Position) => void) => {
    const watchId = Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      (position, err) => {
        if (err) {
          console.error('Error watching position:', err);
          setError('Error monitoreando ubicación');
          return;
        }
        if (position) {
          setPosition(position);
          callback(position);
        }
      }
    );
    return watchId;
  };

  const clearWatch = async (watchId: string) => {
    await Geolocation.clearWatch({ id: watchId });
  };

  const requestPermissions = async () => {
    try {
      const permissions = await Geolocation.requestPermissions();
      return permissions.location === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  };

  return {
    position,
    loading,
    error,
    getCurrentPosition,
    watchPosition,
    clearWatch,
    requestPermissions
  };
};
