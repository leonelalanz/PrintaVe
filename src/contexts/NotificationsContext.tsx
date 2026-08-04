import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Notificacion } from '../types';

interface NotificationsContextType {
  notifications: Notificacion[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter(n => !n.leida).length;

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data as Notificacion[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notificacion;
          setNotifications(prev => [newNotification, ...prev]);

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(newNotification.titulo, {
              body: newNotification.mensaje,
              tag: newNotification.tipo,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, leida: true } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('usuario_id', user.id)
      .eq('leida', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
    }
  };

  const refresh = fetchNotifications;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
  }
  return context;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}
