import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🛡️</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Welcome to ElderShield, {user?.firstName}!
              </h1>
              <p className="text-gray-600 mb-6">
                Your secure platform for senior care management
              </p>
              
              {/* Role-specific content */}
              {isSenior && (
                <div className="bg-blue-50 p-6 rounded-lg mb-6">
                  <h2 className="text-xl font-semibold mb-2">Senior Dashboard</h2>
                  <p className="text-gray-700">
                    Manage your health, connect with family, and stay safe.
                  </p>
                </div>
              )}
              
              {isCaregiver && (
                <div className="bg-green-50 p-6 rounded-lg mb-6">
                  <h2 className="text-xl font-semibold mb-2">Caregiver Dashboard</h2>
                  <p className="text-gray-700">
                    Monitor your loved ones and provide care remotely.
                  </p>
                </div>
              )}
              
              {isAdmin && (
                <div className="bg-purple-50 p-6 rounded-lg mb-6">
                  <h2 className="text-xl font-semibold mb-2">Admin Dashboard</h2>
                  <p className="text-gray-700">
                    Manage the ElderShield platform and users.
                  </p>
                </div>
              )}
              
              {/* Quick actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-2xl mb-2">📊</div>
                  <h3 className="font-semibold">Health Vitals</h3>
                  <p className="text-sm text-gray-600">Track your health metrics</p>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-2xl mb-2">💬</div>
                  <h3 className="font-semibold">Messages</h3>
                  <p className="text-sm text-gray-600">Connect with family</p>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-2xl mb-2">🚨</div>
                  <h3 className="font-semibold">Emergency</h3>
                  <p className="text-sm text-gray-600">Quick access to help</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;