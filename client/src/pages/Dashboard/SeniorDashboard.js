import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const SeniorDashboard = ({ user }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showNotification } = useAuth();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await axios.get('/dashboard');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCheckIn = async () => {
    try {
      // Quick check-in with good values
      const response = await axios.post('/checkins', {
        mood_rating: 4,
        energy_level: 4,
        pain_level: 2,
        sleep_quality: 4,
        appetite_rating: 4,
        hydration_glasses: 6,
        medications_taken: true,
        exercise_minutes: 0,
        social_interaction: false,
        notes: 'Quick check-in from dashboard'
      });

      showNotification('Daily check-in completed successfully!', 'success');
      loadDashboardData(); // Refresh dashboard
    } catch (error) {
      console.error('Error with quick check-in:', error);
      showNotification('Failed to complete check-in', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
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
    hasCheckedInToday, 
    upcomingMedications = [], 
    checkInStreak = { current: 0 }, 
    wellnessScores = [],
    medicationAdherence = { percentage: 0 },
    familyConnections = [],
    unreadMessagesCount = 0
  } = dashboardData || {};

  const latestWellnessScore = wellnessScores[0]?.overall_score || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Good {getTimeGreeting()}, {user.firstName}! 👋
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                Welcome to your SeniorCare Hub dashboard
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {!hasCheckedInToday && (
                <button
                  onClick={handleQuickCheckIn}
                  className="btn-large btn-primary"
                >
                  ✅ Quick Check-in
                </button>
              )}
              <Link
                to="/emergency"
                className="btn-large btn-emergency"
              >
                🚨 Emergency
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Today's Status Banner */}
        <div className="mb-8">
          {hasCheckedInToday ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="text-3xl mr-4">✅</div>
                <div>
                  <h3 className="text-lg font-semibold text-green-800">
                    Great job! You've completed today's check-in
                  </h3>
                  <p className="text-green-700">
                    Keep up the healthy routine. Your family appreciates your updates!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="text-3xl mr-4">📝</div>
                  <div>
                    <h3 className="text-lg font-semibold text-blue-800">
                      Ready for your daily check-in?
                    </h3>
                    <p className="text-blue-700">
                      Take a moment to share how you're feeling today
                    </p>
                  </div>
                </div>
                <Link
                  to="/checkin"
                  className="btn-large btn-primary"
                >
                  Start Check-in
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Check-in Streak */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🔥</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Check-in Streak</p>
                <p className="text-2xl font-bold text-gray-900">{checkInStreak.current} days</p>
              </div>
            </div>
          </div>

          {/* Wellness Score */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">📊</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Wellness Score</p>
                <p className="text-2xl font-bold text-gray-900">{latestWellnessScore}/100</p>
              </div>
            </div>
          </div>

          {/* Medication Adherence */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">💊</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Medication Adherence</p>
                <p className="text-2xl font-bold text-gray-900">{medicationAdherence.percentage}%</p>
              </div>
            </div>
          </div>

          {/* Family Messages */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="text-3xl mr-4">💬</div>
              <div>
                <p className="text-sm font-medium text-gray-600">New Messages</p>
                <p className="text-2xl font-bold text-gray-900">{unreadMessagesCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Today's Medications */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">💊 Today's Medications</h3>
              <Link to="/medications" className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                View All
              </Link>
            </div>
            {upcomingMedications.length > 0 ? (
              <div className="space-y-3">
                {upcomingMedications.slice(0, 3).map((med, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{med.name}</p>
                      <p className="text-sm text-gray-600">{med.dosage}</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(med.scheduled_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                ))}
                {upcomingMedications.length > 3 && (
                  <p className="text-sm text-gray-500 text-center">
                    +{upcomingMedications.length - 3} more medications
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No medications scheduled for today</p>
            )}
          </div>

          {/* Family Connections */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">👨‍👩‍👧‍👦 Family</h3>
              <Link to="/family" className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                Manage
              </Link>
            </div>
            {familyConnections.length > 0 ? (
              <div className="space-y-3">
                {familyConnections.slice(0, 3).map((connection, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-medium">
                        {connection.first_name[0]}{connection.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {connection.first_name} {connection.last_name}
                      </p>
                      <p className="text-sm text-gray-600 capitalize">{connection.relationship}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-3">No family members connected yet</p>
                <Link to="/family" className="btn-large btn-primary">
                  Invite Family
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/checkin"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mr-3">📝</span>
                <span className="font-medium">Daily Check-in</span>
              </Link>
              
              <Link
                to="/messages"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mr-3">💬</span>
                <div className="flex-1">
                  <span className="font-medium">Messages</span>
                  {unreadMessagesCount > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {unreadMessagesCount}
                    </span>
                  )}
                </div>
              </Link>
              
              <Link
                to="/vitals"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mr-3">📊</span>
                <span className="font-medium">Record Vitals</span>
              </Link>
              
              <Link
                to="/emergency"
                className="flex items-center p-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-red-600"
              >
                <span className="text-2xl mr-3">🚨</span>
                <span className="font-medium">Emergency Alert</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Wellness Trends */}
        {wellnessScores.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">📈 Wellness Trends</h3>
              <Link to="/wellness" className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                View Details
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{wellnessScores[0]?.mood_score || 0}</p>
                <p className="text-sm text-blue-700">Mood</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{wellnessScores[0]?.physical_score || 0}</p>
                <p className="text-sm text-green-700">Physical</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{wellnessScores[0]?.social_score || 0}</p>
                <p className="text-sm text-purple-700">Social</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{medicationAdherence.percentage}</p>
                <p className="text-sm text-orange-700">Medication</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center">
          <p className="text-gray-500">
            Your health information is secure and HIPAA compliant 🔐
          </p>
        </div>
      </div>
    </div>
  );
};

// Helper function to get time-based greeting
const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

export default SeniorDashboard;