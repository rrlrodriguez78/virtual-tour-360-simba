import { useState, useEffect } from 'react';
import { 
  PushNotifications, 
  PushNotificationSchema, 
  Token,
  ActionPerformed 
} from '@capacitor/push-notifications';
import { toast } from 'sonner';

export const useNativePushNotifications = () => {
  const [token, setToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<PushNotificationSchema[]>([]);
  const [initialized, setInitialized] = useState(false);

  const initialize = async () => {
    try {
      // Request permission
      const permission = await PushNotifications.requestPermissions();
      
      if (permission.receive === 'granted') {
        // Register with Apple / Google to receive push via APNS/FCM
        await PushNotifications.register();
        
        // Setup listeners
        PushNotifications.addListener('registration', (token: Token) => {
          console.log('Push registration success, token: ' + token.value);
          setToken(token.value);
          toast.success('Notificaciones activadas');
        });

        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Push registration error:', error);
          toast.error('Error al registrar notificaciones');
        });

        PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: PushNotificationSchema) => {
            console.log('Push notification received:', notification);
            setNotifications(prev => [...prev, notification]);
            toast.info(notification.title || 'Nueva notificación', {
              description: notification.body
            });
          }
        );

        PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (notification: ActionPerformed) => {
            console.log('Push notification action performed:', notification);
            // Handle notification tap
          }
        );

        setInitialized(true);
      } else {
        toast.error('Permisos de notificación denegados');
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      toast.error('Error al inicializar notificaciones');
    }
  };

  const getDeliveredNotifications = async () => {
    const notificationList = await PushNotifications.getDeliveredNotifications();
    return notificationList.notifications;
  };

  const removeDeliveredNotifications = async () => {
    await PushNotifications.removeAllDeliveredNotifications();
    setNotifications([]);
  };

  return {
    token,
    notifications,
    initialized,
    initialize,
    getDeliveredNotifications,
    removeDeliveredNotifications
  };
};
