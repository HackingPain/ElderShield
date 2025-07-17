import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { useDevicePlatform } from './services/DevicePlatformService';

// Components
import Header from './components/Header';
import Footer from './components/Footer';

// Authentication Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// Main Dashboard
import Dashboard from './pages/Dashboard/Dashboard';

// Core Pages
import DailyCheckIn from './pages/CheckIn/DailyCheckIn';

// PWA Components
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import EmergencyFloatingButton from './components/EmergencyFloatingButton';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/checkin"
                element={
                  <ProtectedRoute>
                    <DailyCheckIn />
                  </ProtectedRoute>
                }
              />
              
              {/* Placeholder routes for other features */}
              <Route
                path="/medications"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">💊</div>
                        <h1 className="text-2xl font-bold mb-2">Medications</h1>
                        <p className="text-gray-600">Coming soon!</p>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">💬</div>
                        <h1 className="text-2xl font-bold mb-2">Messages</h1>
                        <p className="text-gray-600">Coming soon!</p>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/family"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
                        <h1 className="text-2xl font-bold mb-2">Family Connections</h1>
                        <p className="text-gray-600">Coming soon!</p>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/emergency"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">🚨</div>
                        <h1 className="text-2xl font-bold mb-2">Emergency Alert</h1>
                        <p className="text-gray-600">Coming soon!</p>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/vitals"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">📊</div>
                        <h1 className="text-2xl font-bold mb-2">Health Vitals</h1>
                        <p className="text-gray-600">Coming soon!</p>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/wellness"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">🧠</div>
                        <h1 className="text-2xl font-bold mb-2">AI Wellness Insights</h1>
                        <p className="text-gray-600">Premium feature coming soon!</p>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
              
              {/* 404 Route */}
              <Route path="*" element={
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
                    <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
                    <Navigate to="/dashboard" replace />
                  </div>
                </div>
              } />
            </Routes>
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;