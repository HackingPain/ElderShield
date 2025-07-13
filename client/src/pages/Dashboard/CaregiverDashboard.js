import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const CaregiverDashboard = ({ user }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedSenior, setSelectedSenior] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await axios.get('/dashboard');
      setDashboardData(response.data);
      
      // Auto-select first senior if available
      if (response.data.seniors && response.data.seniors.length > 0) {
        setSelectedSenior(response.data.seniors[0]);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadSeniorData = async (seniorId) => {
    try {
      const response = await axios.get(`/dashboard/senior/${seniorId}`);
      return response.data;
    } catch (error) {
      console.error('Error loading senior data:', error);
      return null;
    }
  };

  const handleSeniorSelect = async (senior) => {
    setSelectedSenior(senior);
    const seniorData = await loadSeniorData(senior.id);
    if (seniorData) {
      setSelectedSenior({ ...senior, ...seniorData });
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await axios.post(`/emergency/alerts/${alertId}/acknowledge`);
      loadDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error acknowledging alert:', error);
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
    seniors = [], 
    alerts = [], 
    checkInSummary = [],
    missedCheckIns = [],
    recentMessages = [],
    unreadMessagesCount = 0
  } = dashboardData || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Caregiver Dashboard 👩‍⚕️
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                Monitoring {seniors.length} family member{seniors.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/family"
                className="btn-large bg-green-600 hover:bg-green-700 text-white"
              >
                👨‍👩‍👧‍👦 Manage Family
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Urgent Alerts Banner */}
        {alerts.length > 0 && (
          <div className="mb-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="text-3xl mr-4">🚨</div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-800">
                      {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
                    </h3>
                    <p className="text-red-700">Requires your attention</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {alerts.slice(0, 3).map((alert, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {alert.first_name} {alert.last_name}
                        </p>
                        <p className="text-sm text-gray-600">{alert.message || alert.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Senior Selection Tabs */}
        {seniors.length > 1 && (
          <div className="mb-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {seniors.map((senior) => (
                  <button
                    key={senior.id}
                    onClick={() => handleSeniorSelect(senior)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      selectedSenior?.id === senior.id
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {senior.first_name} {senior.last_name}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {seniors.length === 0 ? (
          // No Seniors Connected
          <div className="text-center py-12">
            <div className="text-6xl mb-6">👨‍👩‍👧‍👦</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Family Members Yet</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start by connecting with your senior family members to begin monitoring their health and wellness.
            </p>
            <Link
              to="/family"
              className="btn-large btn-primary"
            >
              Connect Family Members
            </Link>
          </div>
        ) : (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="text-3xl mr-4">📊</div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Seniors</p>
                    <p className="text-2xl font-bold text-gray-900">{seniors.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="text-3xl mr-4">✅</div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Checked In Today</p>
                    <p className="text-2xl font-bold text-gray-900">{checkInSummary.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="text-3xl mr-4">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Missed Check-ins</p>
                    <p className="text-2xl font-bold text-gray-900">{missedCheckIns.length}</p>
                  </div>
                </div>
              </div>

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

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Today's Check-ins */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">📝 Today's Check-ins</h3>
                </div>
                {checkInSummary.length > 0 ? (
                  <div className="space-y-3">
                    {checkInSummary.map((checkIn, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900">
                            {checkIn.first_name} {checkIn.last_name}
                          </p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            checkIn.mood_rating >= 4 ? 'bg-green-100 text-green-800' :
                            checkIn.mood_rating >= 3 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            Mood: {checkIn.mood_rating}/5
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                          <div>Energy: {checkIn.energy_level}/5</div>
                          <div>Pain: {checkIn.pain_level}/5</div>
                          <div>Sleep: {checkIn.sleep_quality}/5</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No check-ins completed today</p>
                )}
              </div>

              {/* Missed Check-ins */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">⚠️ Missed Check-ins</h3>
                </div>
                {missedCheckIns.length > 0 ? (
                  <div className="space-y-3">
                    {missedCheckIns.map((senior, index) => (
                      <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="font-medium text-gray-900">
                          {senior.first_name} {senior.last_name}
                        </p>
                        <p className="text-sm text-orange-700">
                          Haven't checked in today
                        </p>
                        <Link
                          to={`/messages/user/${senior.id}`}
                          className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                        >
                          Send reminder →
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    ✅ All family members have checked in today!
                  </p>
                )}
              </div>

              {/* Recent Messages */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">💬 Recent Messages</h3>
                  <Link to="/messages" className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                    View All
                  </Link>
                </div>
                {recentMessages.length > 0 ? (
                  <div className="space-y-3">
                    {recentMessages.slice(0, 4).map((message, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {message.first_name} {message.last_name}
                          </p>
                          <span className="text-xs text-gray-500">
                            {new Date(message.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {message.message_text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No recent messages</p>
                )}
              </div>
            </div>

            {/* Selected Senior Details */}
            {selectedSenior && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedSenior.first_name} {selectedSenior.last_name}'s Overview
                  </h3>
                  <Link
                    to={`/dashboard/senior/${selectedSenior.id}`}
                    className="text-indigo-600 hover:text-indigo-500 font-medium"
                  >
                    View Full Details →
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Quick Stats */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Health Overview</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Check-in Streak:</span>
                        <span className="text-sm font-medium">{selectedSenior.checkInStreak?.current || 0} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Medication Adherence:</span>
                        <span className="text-sm font-medium">{selectedSenior.medicationAdherence?.percentage || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Wellness Score:</span>
                        <span className="text-sm font-medium">{selectedSenior.wellnessScores?.[0]?.overall_score || 0}/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Medications */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Upcoming Medications</h4>
                    {selectedSenior.upcomingMedications?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedSenior.upcomingMedications.slice(0, 3).map((med, index) => (
                          <div key={index} className="text-sm">
                            <p className="font-medium text-gray-900">{med.name}</p>
                            <p className="text-gray-600">{med.dosage} - {new Date(med.scheduled_time).toLocaleTimeString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No upcoming medications</p>
                    )}
                  </div>

                  {/* Recent Vitals */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Recent Vitals</h4>
                    {selectedSenior.recentVitals?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedSenior.recentVitals.slice(0, 3).map((vital, index) => (
                          <div key={index} className="text-sm">
                            <div className="flex justify-between">
                              <span className="capitalize text-gray-600">
                                {vital.reading_type.replace('_', ' ')}:
                              </span>
                              <span className={`font-medium ${vital.is_abnormal ? 'text-red-600' : 'text-gray-900'}`}>
                                {typeof vital.value === 'object' ? JSON.stringify(vital.value) : vital.value} {vital.unit}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No recent vitals</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CaregiverDashboard;