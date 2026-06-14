import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  sendNotification: (userId: string, title: string, message: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userProfile) return;
    try {
      const stored = localStorage.getItem(`notifications_${userProfile.uid}`);
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch (e) {}
  }, [userProfile?.uid]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      if (userProfile) {
        localStorage.setItem(`notifications_${userProfile.uid}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const sendNotification = async (userId: string, title: string, message: string) => {
    const newNotif: Notification = {
      id: Math.random().toString(36).substring(2, 9),
      userId,
      title,
      message,
      read: false,
      type: 'info',
      createdAt: new Date().toISOString()
    };
    
    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      if (userProfile && userId === userProfile.uid) {
        localStorage.setItem(`notifications_${userProfile.uid}`, JSON.stringify(updated));
      }
      return updated;
    });
    
    if (userId === userProfile?.uid) {
      toast(title, { description: message });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, sendNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
