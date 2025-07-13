import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const AdminDashboard = ({ user }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await axios.get('/dashboard');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="btn-large btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { 
    userStats = {}, 
    activityStats = {},
    recentAlerts = []
  } = dashboardData || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Admin Dashboard 👨‍💼
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                SeniorCare Hub System Overview
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/admin/users"
                className="btn-large bg-purple-600 hover:bg-purple-700 text-white"
              >
                👥 Manage Users
              </Link>
              <Link
                to="/admin/reports"
                className="btn-large bg-green-600 hover:bg-green-700 text-white"
              >
                📊 Reports
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Platform Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">👥</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {userStats.total_users || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Seniors */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">👴</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Seniors</p>
                <p className="text-2xl font-bold text-blue-600">
                  {userStats.seniors || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Caregivers */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">👩‍⚕️</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Caregivers</p>
                <p className="text-2xl font-bold text-green-600">
                  {userStats.caregivers || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Premium Users */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">💎</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Premium Users</p>
                <p className="text-2xl font-bold text-purple-600">
                  {userStats.premium_users || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Today's Check-ins */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">📝</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Check-ins Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activityStats.checkins_today || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Messages Today */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">💬</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Messages Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activityStats.messages_today || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Alerts Today */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🚨</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Alerts Today</p>
                <p className="text-2xl font-bold text-red-600">
                  {activityStats.alerts_today || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Medication Reminders */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">💊</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Med Reminders Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activityStats.med_reminders_today || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Emergency Alerts */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">🚨 Recent Emergency Alerts</h3>
            <Link 
              to="/admin/alerts" 
              className="text-indigo-600 hover:text-indigo-500 font-medium"
            >
              View All →
            </Link>
          </div>
          
          {recentAlerts.length > 0 ? (
            <div className="space-y-4">
              {recentAlerts.slice(0, 5).map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      alert.severity === 'critical' ? 'bg-red-600' :
                      alert.severity === 'high' ? 'bg-orange-500' :
                      alert.severity === 'medium' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {alert.first_name} {alert.last_name}
                      </p>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(alert.created_at).toLocaleString()} • {alert.severity.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      alert.alert_type === 'manual' ? 'bg-red-100 text-red-800' :
                      alert.alert_type === 'vitals_abnormal' ? 'bg-orange-100 text-orange-800' :
                      alert.alert_type === 'medication_missed' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {alert.alert_type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-gray-500">No recent emergency alerts</p>
              <p className="text-sm text-gray-400">The system is running smoothly</p>
            </div>
          )}
        </div>

        {/* System Health */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* New Users (30 days) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">📈 Growth</h4>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">New Users (30 days):</span>
                <span className="text-sm font-medium text-green-600">
                  +{userStats.new_users_30d || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Growth Rate:</span>
                <span className="text-sm font-medium text-green-600">
                  +{userStats.total_users > 0 ? (((userStats.new_users_30d || 0) / userStats.total_users) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Premium Conversion:</span>
                <span className="text-sm font-medium text-purple-600">
                  {userStats.total_users > 0 ? (((userStats.premium_users || 0) / userStats.total_users) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">🟢 System Status</h4>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                OPERATIONAL
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">API Status:</span>
                <span className="text-sm font-medium text-green-600">✅ Online</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Database:</span>
                <span className="text-sm font-medium text-green-600">✅ Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Notifications:</span>
                <span className="text-sm font-medium text-green-600">✅ Active</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h4>
            <div className="space-y-3">
              <Link
                to="/admin/broadcast"
                className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium">📢 Send Broadcast</span>
              </Link>
              
              <Link
                to="/admin/maintenance"
                className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium">🔧 System Maintenance</span>
              </Link>
              
              <Link
                to="/admin/export"
                className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium">📊 Export Data</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-500">
            SeniorCare Hub Admin Dashboard • Secure & HIPAA Compliant 🔐
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;