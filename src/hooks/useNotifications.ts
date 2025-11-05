import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Audio notification management using HTMLAudioElement
const playNotificationSound = () => {
  const soundEnabled = localStorage.getItem('notificationSoundEnabled') !== 'false';
  if (!soundEnabled) return;

  try {
    // Crear elemento de audio simple - funciona sin user gesture
    const audio = new Audio();
    
    // Usar data URI para sonido básico (evita CORS)
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dyvm0lCjF8y/LMeSsFJHfH8N2QQAoUXrTp66hVFApGn+Dyvm0lCjF8y/LMeSsFJHfH8N2QQAoUXrTp66hVFApGn+Dyvm0lCjF8y/LMeSsFJHfH8N2QQAoUXrTp66hVFApGn+Dyvm0lCjF8y/LMeSsFJHfH8N2QQAo=';
    audio.volume = 0.3;
    
    // Reproducir y manejar errores silenciosamente
    audio.play().catch(() => {
      // Ignorar errores de reproducción (usuarios con audio deshabilitado)
    });
  } catch (error) {
    // Fallback silencioso
    console.log('Audio not available');
  }
};

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  related_tour_id: string | null;
  related_user_id: string | null;
  metadata: any;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const notificationsData = data || [];
      setNotifications(notificationsData);
      setUnreadCount(notificationsData.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
      // No resetear estado en error, mantener notificaciones existentes
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteAllNotifications = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    let channel: any;

    const setupRealtime = async () => {
      // Cargar notificaciones iniciales
      await loadNotifications();

      // Configurar canal realtime
      channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            
            // Evitar duplicados
            setNotifications(prev => {
              const exists = prev.find(n => n.id === newNotification.id);
              if (exists) return prev;
              
              return [newNotification, ...prev];
            });
            
            // Solo incrementar si no está leída
            if (!newNotification.read) {
              setUnreadCount(prev => prev + 1);
              playNotificationSound(); // 🔔 Solo sonar para no leídas
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const updatedNotification = payload.new as Notification;
            
            setNotifications(prev =>
              prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
            );
            
            // Recalcular unreadCount después de actualización
            setUnreadCount(prev => {
              const oldRead = (payload.old as any).read;
              const newRead = updatedNotification.read;
              
              if (oldRead && !newRead) return prev + 1;  // Se marcó como no leída
              if (!oldRead && newRead) return Math.max(0, prev - 1);  // Se marcó como leída
              return prev;  // Sin cambio en estado read
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Notifications channel subscribed');
          }
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteAllNotifications,
    refresh: loadNotifications
  };
};
