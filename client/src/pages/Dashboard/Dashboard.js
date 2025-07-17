import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SeniorDashboard from './SeniorDashboard';
import CaregiverDashboard from './CaregiverDashboard';
import AdminDashboard from './AdminDashboard';

const Dashboard = () => {
  const { user, isSenior, isCaregiver, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time for better UX
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Render role-specific dashboard
  if (isSenior()) {
    return <SeniorDashboard user={user} />;
  } else if (isCaregiver()) {
    return <CaregiverDashboard user={user} />;
  } else if (isAdmin()) {
    return <AdminDashboard user={user} />;
  }

  // Fallback - should not happen with proper auth
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to ElderShield</h1>
        <p className="text-gray-600">Please complete your profile setup to access your dashboard.</p>
      </div>
    </div>
  );
};

export default Dashboard;