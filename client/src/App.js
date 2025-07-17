import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import Layout from './components/Layout';

// Authentication Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// Main Dashboard
import Dashboard from './pages/Dashboard/Dashboard';

// Core Pages
import DailyCheckIn from './pages/CheckIn/DailyCheckIn';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
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
      <Router>
        <Layout>
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
                      <h1 className="text-2xl font-bold mb-2">Family</h1>
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
                  <div className="min-h-screen bg-red-50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🚨</div>
                      <h1 className="text-2xl font-bold mb-2 text-red-600">Emergency</h1>
                      <p className="text-gray-600">Emergency contact system</p>
                      <a href="tel:911" className="mt-4 inline-block bg-red-600 text-white px-6 py-3 rounded-lg">
                        Call 911
                      </a>
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
                      <h1 className="text-2xl font-bold mb-2">Vitals</h1>
                      <p className="text-gray-600">Coming soon!</p>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">⚙️</div>
                      <h1 className="text-2xl font-bold mb-2">Settings</h1>
                      <p className="text-gray-600">Coming soon!</p>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            
            {/* Fallback Route */}
            <Route
              path="*"
              element={
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🚀</div>
                    <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
                    <p className="text-gray-600">The page you're looking for doesn't exist.</p>
                  </div>
                </div>
              }
            />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;