import { useState, useEffect } from 'react';
import { Device, DeviceInfo } from '@capacitor/device';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const useNativeDevice = () => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [networkStatus, setNetworkStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    loadDeviceInfo();
    loadNetworkStatus();
    
    // Listen for network status changes
    const listener = Network.addListener('networkStatusChange', status => {
      setNetworkStatus(status);
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  const loadDeviceInfo = async () => {
    const info = await Device.getInfo();
    setDeviceInfo(info);
  };

  const loadNetworkStatus = async () => {
    const status = await Network.getStatus();
    setNetworkStatus(status);
  };

  const getBatteryInfo = async () => {
    return await Device.getBatteryInfo();
  };

  const getLanguageCode = async () => {
    return await Device.getLanguageCode();
  };

  const vibrateLight = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const vibrateMedium = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const vibrateHeavy = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  return {
    deviceInfo,
    networkStatus,
    getBatteryInfo,
    getLanguageCode,
    vibrateLight,
    vibrateMedium,
    vibrateHeavy,
    isOnline: networkStatus?.connected ?? true,
    connectionType: networkStatus?.connectionType
  };
};
