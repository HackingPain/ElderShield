import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

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

// Configure axios defaults
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

// Authentication Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('seniorcare_token'));

  // Set up axios interceptor for token
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          logout();
          // Show user-friendly message
          showNotification('Session expired. Please log in again.', 'error');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [token]);

  // Load user on app start
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await axios.get('/auth/profile');
          setUser(response.data.user);
        } catch (error) {
          console.error('Error loading user:', error);
          localStorage.removeItem('seniorcare_token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [token]);

  // Simple notification function (can be enhanced with toast library)
  const showNotification = (message, type = 'info') => {
    // For now, use alert - can be replaced with toast library
    if (type === 'error') {
      alert(`Error: ${message}`);
    } else if (type === 'success') {
      alert(`Success: ${message}`);
    } else {
      alert(message);
    }
  };

  // Login function
  const login = async (email, password, rememberMe = false) => {
    try {
      setLoading(true);
      const response = await axios.post('/auth/login', {
        email,
        password,
        rememberMe,
      });

      const { user: userData, token: userToken } = response.data;

      // Store token
      localStorage.setItem('seniorcare_token', userToken);
      setToken(userToken);
      setUser(userData);

      // Show success message
      showNotification(`Welcome back, ${userData.firstName}!`, 'success');

      return { success: true, user: userData };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setLoading(true);
      const response = await axios.post('/auth/register', userData);

      const { user: newUser, token: userToken } = response.data;

      // Store token
      localStorage.setItem('seniorcare_token', userToken);
      setToken(userToken);
      setUser(newUser);

      // Show success message
      showNotification(`Welcome to SeniorCare Hub, ${newUser.firstName}!`, 'success');

      return { success: true, user: newUser };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem('seniorcare_token');
      setToken(null);
      setUser(null);
      showNotification('Logged out successfully', 'success');
    }
  };

  // Update profile function
  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/auth/profile', profileData);
      
      // Update user state
      setUser(response.data.user);
      showNotification('Profile updated successfully', 'success');
      
      return { success: true, user: response.data.user };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Profile update failed';
      showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    }
  };

  // Change password function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      
      showNotification('Password changed successfully', 'success');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Password change failed';
      showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    }
  };

  // Forgot password function
  const forgotPassword = async (email) => {
    try {
      const response = await axios.post('/auth/forgot-password', { email });
      
      showNotification('Password reset link sent to your email', 'success');
      return { success: true, message: response.data.message };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Password reset failed';
      showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    }
  };

  // Reset password function
  const resetPassword = async (token, password) => {
    try {
      await axios.post('/auth/reset-password', {
        token,
        password,
      });
      
      showNotification('Password reset successfully', 'success');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Password reset failed';
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

  const isSubscriptionExpired = () => {
    if (!user?.subscription_expires_at) return false;
    return new Date(user.subscription_expires_at) < new Date();
  };

  // Context value
  const value = {
    // State
    user,
    loading,
    token,
    
    // Authentication methods
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    
    // Utility methods
    isPremiumUser,
    isAdmin,
    isCaregiver,
    isSenior,
    getUserFullName,
    getUserInitials,
    isSubscriptionExpired,
    showNotification,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};