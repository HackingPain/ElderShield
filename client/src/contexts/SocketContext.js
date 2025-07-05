import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

// Create the socket context
const SocketContext = createContext();

// Custom hook to use the socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// Socket Provider Component
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user, token } = useAuth();

  // Initialize socket connection
  useEffect(() => {
    if (user && token) {
      const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
      
      const newSocket = io(socketUrl, {
        auth: {
          token: token,
        },
        autoConnect: true,
      });

      setSocket(newSocket);

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);
        
        // Join user's personal room
        newSocket.emit('join-room', user.id);
        
        // Join family rooms if user is a caregiver
        if (user.familyConnections && user.familyConnections.length > 0) {
          user.familyConnections.forEach(connection => {
            const roomId = connection.senior_id === user.id 
              ? connection.caregiver_id 
              : connection.senior_id;
            newSocket.emit('join-room', roomId);
          });
        }
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnected(false);
      });

      // Real-time event handlers
      newSocket.on('receive-message', (data) => {
        // Handle incoming messages
        console.log('New message received:', data);
        
        // Show notification for new messages
        if (data.senderId !== user.id) {
          toast.success(`New message from ${data.senderName}`, {
            icon: '💬',
          });
        }
      });

      newSocket.on('emergency-notification', (data) => {
        // Handle emergency alerts
        console.log('Emergency alert received:', data);
        
        toast.error(`🚨 Emergency Alert: ${data.message}`, {
          duration: 10000,
          style: {
            background: '#fef2f2',
            color: '#dc2626',
            border: '2px solid #f87171',
            fontSize: '1.25rem',
            fontWeight: '600',
          },
        });

        // Play emergency sound (if supported)
        try {
          const audio = new Audio('/sounds/emergency-alert.mp3');
          audio.play().catch(console.error);
        } catch (error) {
          console.warn('Could not play emergency sound:', error);
        }
      });

      newSocket.on('medication-reminder', (data) => {
        // Handle medication reminders
        console.log('Medication reminder:', data);
        
        toast(`💊 Time for ${data.medicationName}`, {
          duration: 8000,
          style: {
            background: '#fffbeb',
            color: '#d97706',
            border: '1px solid #fbbf24',
            fontSize: '1.125rem',
          },
        });
      });

      newSocket.on('wellness-alert', (data) => {
        // Handle wellness anomaly alerts
        console.log('Wellness alert:', data);
        
        toast(`📊 Wellness Alert: ${data.message}`, {
          duration: 6000,
          style: {
            background: '#eff6ff',
            color: '#2563eb',
            border: '1px solid #60a5fa',
          },
        });
      });

      newSocket.on('appointment-reminder', (data) => {
        // Handle appointment reminders
        console.log('Appointment reminder:', data);
        
        toast(`📅 Appointment Reminder: ${data.title} in ${data.timeUntil}`, {
          duration: 6000,
          style: {
            background: '#f0fdf4',
            color: '#16a34a',
            border: '1px solid #4ade80',
          },
        });
      });

      newSocket.on('family-connection-request', (data) => {
        // Handle family connection requests
        console.log('Family connection request:', data);
        
        toast(`👨‍👩‍👧‍👦 New family connection request from ${data.requesterName}`, {
          duration: 8000,
          style: {
            background: '#eff6ff',
            color: '#2563eb',
            border: '1px solid #60a5fa',
          },
        });
      });

      newSocket.on('vitals-alert', (data) => {
        // Handle vitals alerts
        console.log('Vitals alert:', data);
        
        const isUrgent = data.severity === 'high' || data.severity === 'critical';
        
        toast(`${isUrgent ? '⚠️' : '📈'} Vitals Alert: ${data.message}`, {
          duration: isUrgent ? 10000 : 6000,
          style: {
            background: isUrgent ? '#fef2f2' : '#fffbeb',
            color: isUrgent ? '#dc2626' : '#d97706',
            border: isUrgent ? '2px solid #f87171' : '1px solid #fbbf24',
            fontSize: isUrgent ? '1.25rem' : '1.125rem',
            fontWeight: isUrgent ? '600' : '500',
          },
        });
      });

      newSocket.on('check-in-reminder', (data) => {
        // Handle daily check-in reminders
        console.log('Check-in reminder:', data);
        
        toast('📝 Don\'t forget your daily check-in!', {
          duration: 6000,
          style: {
            background: '#fefce8',
            color: '#ca8a04',
            border: '1px solid #fde047',
          },
        });
      });

      newSocket.on('online-users', (users) => {
        // Update online users list
        setOnlineUsers(users);
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user, token]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  // Send message function
  const sendMessage = (recipientId, message, messageType = 'text') => {
    if (!socket || !connected) {
      toast.error('Connection lost. Please try again.');
      return false;
    }

    const messageData = {
      senderId: user.id,
      recipientId,
      message,
      messageType,
      timestamp: new Date().toISOString(),
      senderName: `${user.firstName} ${user.lastName}`,
    };

    socket.emit('send-message', {
      roomId: recipientId,
      ...messageData,
    });

    return true;
  };

  // Send emergency alert function
  const sendEmergencyAlert = (alertType, message, location = null) => {
    if (!socket || !connected) {
      toast.error('Connection lost. Unable to send emergency alert.');
      return false;
    }

    const alertData = {
      userId: user.id,
      alertType,
      message,
      location,
      timestamp: new Date().toISOString(),
      userName: `${user.firstName} ${user.lastName}`,
    };

    // Send to all connected family members
    if (user.familyConnections && user.familyConnections.length > 0) {
      user.familyConnections.forEach(connection => {
        const roomId = connection.senior_id === user.id 
          ? connection.caregiver_id 
          : connection.senior_id;
        
        socket.emit('emergency-alert', {
          roomId,
          ...alertData,
        });
      });
    }

    toast.success('Emergency alert sent to family members');
    return true;
  };

  // Join a room (for family connections, care teams, etc.)
  const joinRoom = (roomId) => {
    if (socket && connected) {
      socket.emit('join-room', roomId);
    }
  };

  // Leave a room
  const leaveRoom = (roomId) => {
    if (socket && connected) {
      socket.emit('leave-room', roomId);
    }
  };

  // Check if user is online
  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  // Get connection status
  const getConnectionStatus = () => {
    return {
      connected,
      socket: !!socket,
      onlineUsers: onlineUsers.length,
    };
  };

  // Reconnect function
  const reconnect = () => {
    if (socket) {
      socket.connect();
    }
  };

  // Context value
  const value = {
    // State
    socket,
    connected,
    onlineUsers,
    
    // Methods
    sendMessage,
    sendEmergencyAlert,
    joinRoom,
    leaveRoom,
    isUserOnline,
    getConnectionStatus,
    reconnect,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};