import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Layout Components
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import Footer from './components/Layout/Footer';
import LoadingSpinner from './components/UI/LoadingSpinner';
import EmergencyButton from './components/Emergency/EmergencyButton';

// Authentication Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';

// Main Application Pages
import Dashboard from './pages/Dashboard/Dashboard';
import DailyCheckIn from './pages/CheckIn/DailyCheckIn';
import Medications from './pages/Medications/Medications';
import Messages from './pages/Messages/Messages';
import Family from './pages/Family/Family';
import Profile from './pages/Profile/Profile';
import Settings from './pages/Settings/Settings';
import Vitals from './pages/Vitals/Vitals';
import Calendar from './pages/Calendar/Calendar';
import Journal from './pages/Journal/Journal';
import Emergency from './pages/Emergency/Emergency';

// Premium Features
import WellnessScore from './pages/Premium/WellnessScore';
import VideoCall from './pages/Premium/VideoCall';
import CareTeam from './pages/Premium/CareTeam';

// Error Pages
import NotFound from './pages/Error/NotFound';
import Unauthorized from './pages/Error/Unauthorized';

// Import CSS
import './index.css';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole = null, requiresPremium = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiresPremium && user.subscriptionTier !== 'premium') {
    return <Navigate to="/upgrade" replace />;
  }

  return children;
};

// Main App Layout Component
const AppLayout = ({ children }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      
      {/* Sidebar */}
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      {/* Main Content */}
      <main className="lg:pl-64 pt-16">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
      
      {/* Emergency Button - Always visible for seniors */}
      {user && user.role === 'senior' && (
        <EmergencyButton />
      )}
      
      {/* Footer */}
      <Footer />
      
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            fontSize: '1.125rem',
            padding: '16px 24px',
            maxWidth: '500px',
          },
          success: {
            style: {
              background: '#f0fdf4',
              color: '#16a34a',
              border: '1px solid #4ade80',
            },
          },
          error: {
            style: {
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #f87171',
            },
          },
        }}
      />
    </div>
  );
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
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/checkin"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <DailyCheckIn />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/medications"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Medications />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Messages />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/family"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Family />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Profile />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Settings />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/vitals"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Vitals />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Calendar />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/journal"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Journal />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/emergency"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Emergency />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Premium Features */}
              <Route
                path="/wellness"
                element={
                  <ProtectedRoute requiresPremium={true}>
                    <AppLayout>
                      <WellnessScore />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/video-call"
                element={
                  <ProtectedRoute requiresPremium={true}>
                    <AppLayout>
                      <VideoCall />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/care-team"
                element={
                  <ProtectedRoute requiresPremium={true}>
                    <AppLayout>
                      <CareTeam />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Error Routes */}
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;