import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user, token } = useAuth();

  useEffect(() => {
    if (user && token) {
      // Initialize socket connection
      const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
      
      const newSocket = io(SOCKET_URL, {
        auth: {
          token: token,
          userId: user.id
        },
        transports: ['websocket', 'polling']
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);
        
        // Join user-specific room
        newSocket.emit('join-room', `user_${user.id}`);
        
        // Join family rooms if user is a caregiver
        if (user.role === 'caregiver' && user.familyConnections) {
          user.familyConnections.forEach(connection => {
            if (connection.status === 'active') {
              newSocket.emit('join-room', `family_${connection.senior_id}`);
            }
          });
        }
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnected(false);
      });

      // Message events
      newSocket.on('new_message', (data) => {
        console.log('New message received:', data);
        // Trigger notification or update UI
        showNotification(`New message from ${data.senderName}`, data.messageText);
      });

      // Emergency alert events
      newSocket.on('emergency_notification', (data) => {
        console.log('Emergency alert received:', data);
        showEmergencyNotification(data);
      });

      // Medication reminder events
      newSocket.on('medication_reminder', (data) => {
        console.log('Medication reminder:', data);
        showMedicationReminder(data);
      });

      // Wellness anomaly alerts
      newSocket.on('wellness_anomaly_alert', (data) => {
        console.log('Wellness anomaly detected:', data);
        showWellnessAlert(data);
      });

      // Online users updates
      newSocket.on('online_users_update', (users) => {
        setOnlineUsers(users);
      });

      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        newSocket.close();
        setSocket(null);
        setConnected(false);
      };
    }
  }, [user, token]);

  // Helper functions for notifications
  const showNotification = (title, message, type = 'info') => {
    // Create browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'seniorcare-notification'
      });
    }
    
    // Also show in-app notification
    console.log(`${type.toUpperCase()}: ${title} - ${message}`);
  };

  const showEmergencyNotification = (data) => {
    // High priority emergency notification
    const title = '🚨 EMERGENCY ALERT';
    const message = `${data.seniorName}: ${data.message}`;
    
    // Browser notification with high priority
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: message,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'emergency-alert',
        requireInteraction: true,
        vibrate: [200, 100, 200]
      });
      
      // Auto-close after 30 seconds
      setTimeout(() => notification.close(), 30000);
    }
    
    // Play alert sound if available
    try {
      const audio = new Audio('/sounds/emergency-alert.mp3');
      audio.play().catch(e => console.log('Could not play alert sound:', e));
    } catch (e) {
      console.log('Alert sound not available');
    }
    
    console.log('EMERGENCY:', message);
  };

  const showMedicationReminder = (data) => {
    const title = '💊 Medication Reminder';
    const message = `Time to take ${data.medicationName} (${data.dosage})`;
    
    showNotification(title, message, 'medication');
  };

  const showWellnessAlert = (data) => {
    const title = '📊 Wellness Alert';
    const message = `${data.seniorName}: ${data.anomaly.description}`;
    
    showNotification(title, message, 'wellness');
  };

  // Socket event emitters
  const sendMessage = (recipientId, messageData) => {
    if (socket && connected) {
      socket.emit('send-message', {
        roomId: `user_${recipientId}`,
        senderId: user.id,
        senderName: `${user.firstName} ${user.lastName}`,
        ...messageData
      });
    }
  };

  const sendEmergencyAlert = (alertData) => {
    if (socket && connected) {
      socket.emit('emergency-alert', {
        roomId: `family_${user.id}`,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        ...alertData
      });
    }
  };

  const joinRoom = (roomId) => {
    if (socket && connected) {
      socket.emit('join-room', roomId);
    }
  };

  const leaveRoom = (roomId) => {
    if (socket && connected) {
      socket.emit('leave-room', roomId);
    }
  };

  // Request notification permission on load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  const value = {
    socket,
    connected,
    onlineUsers,
    sendMessage,
    sendEmergencyAlert,
    joinRoom,
    leaveRoom,
    showNotification,
    showEmergencyNotification
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};