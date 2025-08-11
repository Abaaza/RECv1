import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, Check, AlertCircle, Calendar, Users,
  MessageSquare, Phone, Clock, ChevronRight,
  AlertTriangle, CheckCircle, Info, XCircle,
  Mail, Mic, Video, FileText, DollarSign
} from 'lucide-react';
import { io } from 'socket.io-client';
import { format } from 'date-fns';

const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [filter, setFilter] = useState('all');
  const [socket, setSocket] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Notification types and their configurations
  const notificationConfig = {
    appointment_new: {
      icon: Calendar,
      color: 'bg-blue-500',
      sound: 'notification.mp3',
      priority: 'normal'
    },
    appointment_cancelled: {
      icon: XCircle,
      color: 'bg-red-500',
      sound: 'alert.mp3',
      priority: 'high'
    },
    appointment_reminder: {
      icon: Clock,
      color: 'bg-yellow-500',
      sound: 'reminder.mp3',
      priority: 'normal'
    },
    emergency: {
      icon: AlertTriangle,
      color: 'bg-red-600',
      sound: 'emergency.mp3',
      priority: 'urgent'
    },
    patient_arrived: {
      icon: Users,
      color: 'bg-green-500',
      sound: 'arrival.mp3',
      priority: 'normal'
    },
    message_received: {
      icon: MessageSquare,
      color: 'bg-purple-500',
      sound: 'message.mp3',
      priority: 'low'
    },
    call_incoming: {
      icon: Phone,
      color: 'bg-indigo-500',
      sound: 'ringtone.mp3',
      priority: 'high'
    },
    payment_received: {
      icon: DollarSign,
      color: 'bg-green-600',
      sound: 'payment.mp3',
      priority: 'normal'
    },
    system_alert: {
      icon: Info,
      color: 'bg-gray-500',
      sound: 'system.mp3',
      priority: 'low'
    },
    ai_insight: {
      icon: AlertCircle,
      color: 'bg-purple-600',
      sound: 'insight.mp3',
      priority: 'normal'
    }
  };

  useEffect(() => {
    // Initialize WebSocket connection
    const socketUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5001';
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Connected to notification server');
    });

    newSocket.on('notification', handleNewNotification);
    newSocket.on('bulk_notifications', handleBulkNotifications);

    setSocket(newSocket);

    // Load stored notifications
    loadStoredNotifications();

    return () => {
      newSocket.close();
    };
  }, []);

  const loadStoredNotifications = () => {
    const stored = localStorage.getItem('dental_notifications');
    if (stored) {
      const parsed = JSON.parse(stored);
      setNotifications(parsed);
      updateUnreadCount(parsed);
    }
  };

  const saveNotifications = (notifs) => {
    localStorage.setItem('dental_notifications', JSON.stringify(notifs.slice(0, 100))); // Keep last 100
  };

  const handleNewNotification = useCallback((notification) => {
    const enrichedNotification = {
      ...notification,
      id: notification.id || Date.now().toString(),
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false
    };

    setNotifications(prev => {
      const updated = [enrichedNotification, ...prev];
      saveNotifications(updated);
      updateUnreadCount(updated);
      return updated;
    });

    // Play sound if enabled
    if (soundEnabled && notificationConfig[notification.type]?.sound) {
      playNotificationSound(notificationConfig[notification.type].sound);
    }

    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
      showBrowserNotification(enrichedNotification);
    }

    // Auto-dismiss low priority notifications after 10 seconds
    if (notificationConfig[notification.type]?.priority === 'low') {
      setTimeout(() => {
        markAsRead(enrichedNotification.id);
      }, 10000);
    }
  }, [soundEnabled]);

  const handleBulkNotifications = useCallback((notifications) => {
    setNotifications(prev => {
      const updated = [...notifications, ...prev];
      saveNotifications(updated);
      updateUnreadCount(updated);
      return updated;
    });
  }, []);

  const updateUnreadCount = (notifs) => {
    const unread = notifs.filter(n => !n.read).length;
    setUnreadCount(unread);
    
    // Update browser tab title with count
    if (unread > 0) {
      document.title = `(${unread}) Dental AI Receptionist`;
    } else {
      document.title = 'Dental AI Receptionist';
    }
  };

  const playNotificationSound = (soundFile) => {
    try {
      const audio = new Audio(`/sounds/${soundFile}`);
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Could not play sound:', err));
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const showBrowserNotification = (notification) => {
    const config = notificationConfig[notification.type];
    const title = notification.title || 'New Notification';
    const options = {
      body: notification.message,
      icon: '/logo.png',
      badge: '/badge.png',
      tag: notification.id,
      requireInteraction: config?.priority === 'urgent',
      silent: !soundEnabled
    };

    new Notification(title, options);
  };

  const markAsRead = (notificationId) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      saveNotifications(updated);
      updateUnreadCount(updated);
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      updateUnreadCount(updated);
      return updated;
    });
  };

  const deleteNotification = (notificationId) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notificationId);
      saveNotifications(updated);
      updateUnreadCount(updated);
      return updated;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem('dental_notifications');
    setUnreadCount(0);
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    if (filter === 'urgent') return notificationConfig[n.type]?.priority === 'urgent';
    if (filter === 'appointments') return n.type.includes('appointment');
    return n.type === filter;
  });

  const NotificationItem = ({ notification }) => {
    const config = notificationConfig[notification.type] || notificationConfig.system_alert;
    const Icon = config.icon;

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className={`p-4 border-l-4 ${notification.read ? 'bg-gray-50' : 'bg-white'} 
                   hover:bg-gray-100 transition-colors cursor-pointer
                   ${notification.read ? 'border-gray-300' : config.color.replace('bg-', 'border-')}`}
        onClick={() => {
          if (!notification.read) {
            markAsRead(notification.id);
          }
          if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
          }
        }}
      >
        <div className="flex items-start">
          <div className={`p-2 rounded-lg ${config.color} mr-3`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h4 className={`font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                  {notification.title}
                </h4>
                <p className={`text-sm mt-1 ${notification.read ? 'text-gray-500' : 'text-gray-600'}`}>
                  {notification.message}
                </p>
                {notification.metadata && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(notification.metadata).map(([key, value]) => (
                      <span key={key} className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(notification.id);
                }}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">
                {format(new Date(notification.timestamp), 'MMM d, h:mm a')}
              </span>
              {notification.actionLabel && (
                <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center">
                  {notification.actionLabel}
                  <ChevronRight className="w-3 h-3 ml-1" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      {/* Notification Bell Button */}
      <div className="relative">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </button>
      </div>

      {/* Notification Panel */}
      <AnimatePresence>
        {showPanel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-25 z-40"
              onClick={() => setShowPanel(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold">Notifications</h2>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`p-1 rounded ${soundEnabled ? 'bg-white bg-opacity-20' : 'bg-opacity-10'}`}
                    >
                      {soundEnabled ? <Bell className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={requestNotificationPermission}
                      className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded"
                    >
                      Enable Desktop
                    </button>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={markAllAsRead}
                      className="text-xs hover:bg-white hover:bg-opacity-20 px-2 py-1 rounded transition-colors"
                    >
                      Mark all read
                    </button>
                    <button
                      onClick={clearAll}
                      className="text-xs hover:bg-white hover:bg-opacity-20 px-2 py-1 rounded transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="px-4 py-2 border-b bg-gray-50">
                <div className="flex space-x-2 overflow-x-auto">
                  {['all', 'unread', 'urgent', 'appointments'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 text-sm rounded-lg capitalize whitespace-nowrap
                                ${filter === f 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <Bell className="w-12 h-12 mb-3" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    <AnimatePresence>
                      {filteredNotifications.map(notification => (
                        <NotificationItem 
                          key={notification.id} 
                          notification={notification} 
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default NotificationSystem;