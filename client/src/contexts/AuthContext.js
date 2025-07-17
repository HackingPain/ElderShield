import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the authentication context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Mock user data for demo purposes
const DEMO_USERS = {
  'senior@demo.com': {
    id: '1',
    email: 'senior@demo.com',
    firstName: 'Mary',
    lastName: 'Johnson',
    role: 'senior',
    subscription_tier: 'premium'
  },
  'caregiver@demo.com': {
    id: '2',
    email: 'caregiver@demo.com',
    firstName: 'John',
    lastName: 'Smith',
    role: 'caregiver',
    subscription_tier: 'standard'
  },
  'admin@demo.com': {
    id: '3',
    email: 'admin@demo.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    subscription_tier: 'enterprise'
  }
};

// Authentication Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false); // Start with false instead of true

  // Load user on app start
  useEffect(() => {
    const loadUser = () => {
      try {
        const savedUser = localStorage.getItem('eldershield_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('Error loading user:', error);
        localStorage.removeItem('eldershield_user');
      }
    };

    loadUser();
  }, []);

  // Simple notification function
  const showNotification = (message, type = 'info') => {
    console.log(`${type.toUpperCase()}: ${message}`);
    // You can integrate with a toast library here
  };

  // Login function (mock implementation)
  const login = async (email, password, rememberMe = false) => {
    try {
      setLoading(true);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check demo users
      const demoUser = DEMO_USERS[email];
      
      if (demoUser && password === 'password123') {
        // Store user
        localStorage.setItem('eldershield_user', JSON.stringify(demoUser));
        setUser(demoUser);
        
        showNotification(`Welcome back, ${demoUser.firstName}!`, 'success');
        return { success: true, user: demoUser };
      } else {
        const errorMessage = 'Invalid credentials. Use demo accounts: senior@demo.com / caregiver@demo.com with password123';
        showNotification(errorMessage, 'error');
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = 'Login failed. Please try again.';
      showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Register function (mock implementation)
  const register = async (userData) => {
    try {
      setLoading(true);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create new user
      const newUser = {
        id: Date.now().toString(),
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'senior',
        subscription_tier: 'standard'
      };
      
      // Store user
      localStorage.setItem('eldershield_user', JSON.stringify(newUser));
      setUser(newUser);
      
      showNotification(`Welcome to ElderShield, ${newUser.firstName}!`, 'success');
      return { success: true, user: newUser };
    } catch (error) {
      const errorMessage = 'Registration failed. Please try again.';
      showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Clear local storage and state
      localStorage.removeItem('eldershield_user');
      setUser(null);
      showNotification('Logged out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Update profile function
  const updateProfile = async (profileData) => {
    try {
      const updatedUser = { ...user, ...profileData };
      localStorage.setItem('eldershield_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      showNotification('Profile updated successfully', 'success');
      return { success: true, user: updatedUser };
    } catch (error) {
      const errorMessage = 'Profile update failed';
      showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    }
  };

  // Utility functions
  const isPremiumUser = () => {
    return user?.subscription_tier === 'premium' || user?.subscription_tier === 'enterprise';
  };

  const isAdmin = () => {
    return user?.role === 'admin';
  };

  const isCaregiver = () => {
    return user?.role === 'caregiver';
  };

  const isSenior = () => {
    return user?.role === 'senior';
  };

  const getUserFullName = () => {
    return user ? `${user.firstName} ${user.lastName}` : '';
  };

  const getUserInitials = () => {
    return user 
      ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
      : '';
  };

  // Context value
  const value = {
    // State
    user,
    loading,
    
    // Authentication methods
    login,
    register,
    logout,
    updateProfile,
    
    // Utility methods
    isPremiumUser,
    isAdmin,
    isCaregiver,
    isSenior,
    getUserFullName,
    getUserInitials,
    showNotification,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};