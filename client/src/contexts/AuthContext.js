import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

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
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
axios.defaults.withCredentials = true;

// Authentication Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

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
          toast.error('Session expired. Please log in again.');
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
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [token]);

  // Login function
  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await axios.post('/auth/login', {
        email,
        password,
        rememberMe,
      });

      const { user: userData, token: userToken } = response.data;

      // Store token
      localStorage.setItem('token', userToken);
      setToken(userToken);
      setUser(userData);

      // Show success message
      toast.success(`Welcome back, ${userData.firstName}!`);

      return { success: true, user: userData };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      const response = await axios.post('/auth/register', userData);

      const { user: newUser, token: userToken } = response.data;

      // Store token
      localStorage.setItem('token', userToken);
      setToken(userToken);
      setUser(newUser);

      // Show success message
      toast.success(`Welcome to SeniorCare Hub, ${newUser.firstName}!`);

      return { success: true, user: newUser };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
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
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      toast.success('Logged out successfully');
    }
  };

  // Update profile function
  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/auth/profile', profileData);
      
      // Update user state
      setUser(response.data.user);
      toast.success('Profile updated successfully');
      
      return { success: true, user: response.data.user };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Profile update failed';
      toast.error(errorMessage);
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
      
      toast.success('Password changed successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Password change failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Forgot password function
  const forgotPassword = async (email) => {
    try {
      const response = await axios.post('/auth/forgot-password', { email });
      
      toast.success('Password reset link sent to your email');
      return { success: true, message: response.data.message };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Password reset failed';
      toast.error(errorMessage);
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
      
      toast.success('Password reset successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Password reset failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Verify email function
  const verifyEmail = async () => {
    try {
      await axios.post('/auth/verify-email');
      
      // Update user state
      setUser(prev => ({ ...prev, emailVerified: true }));
      toast.success('Email verified successfully');
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Email verification failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Refresh token function
  const refreshToken = async () => {
    try {
      const response = await axios.post('/auth/refresh');
      
      const { token: newToken } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      
      return { success: true };
    } catch (error) {
      console.error('Token refresh failed:', error);
      return { success: false };
    }
  };

  // Check if user has premium subscription
  const isPremiumUser = () => {
    return user?.subscriptionTier === 'premium';
  };

  // Check if user is admin
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  // Check if user is caregiver
  const isCaregiver = () => {
    return user?.role === 'caregiver';
  };

  // Check if user is senior
  const isSenior = () => {
    return user?.role === 'senior';
  };

  // Get user's full name
  const getUserFullName = () => {
    return user ? `${user.firstName} ${user.lastName}` : '';
  };

  // Get user's initials
  const getUserInitials = () => {
    return user 
      ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
      : '';
  };

  // Check if subscription is expired
  const isSubscriptionExpired = () => {
    if (!user?.subscriptionExpiresAt) return false;
    return new Date(user.subscriptionExpiresAt) < new Date();
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
    verifyEmail,
    refreshToken,
    
    // Utility methods
    isPremiumUser,
    isAdmin,
    isCaregiver,
    isSenior,
    getUserFullName,
    getUserInitials,
    isSubscriptionExpired,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};