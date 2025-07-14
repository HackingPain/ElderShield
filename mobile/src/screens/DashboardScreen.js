import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ApiService from '../services/ApiService';
import { useDevicePlatform } from '../hooks/useDevicePlatform';

const { width } = Dimensions.get('window');

const DashboardScreen = ({ navigation }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const { deviceType, uiConfig, isKioskMode } = useDevicePlatform();

  useFocusEffect(
    React.useCallback(() => {
      loadDashboardData();
    }, [])
  );

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getDashboard();
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert(
        'Connection Error',
        'Unable to load dashboard data. Please check your internet connection.',
        [
          { text: 'Retry', onPress: loadDashboardData },
          { text: 'Cancel' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const QuickActionCard = ({ title, icon, color, onPress, badge }) => (
    <TouchableOpacity
      style={[
        styles.quickActionCard,
        { backgroundColor: color },
        isKioskMode && styles.kioskCard
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardIcon}>
        <Icon name={icon} size={isKioskMode ? 48 : 32} color="#ffffff" />
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[
        styles.cardTitle,
        isKioskMode && styles.kioskText
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const StatusCard = ({ title, value, subtitle, icon, color }) => (
    <View style={[styles.statusCard, isKioskMode && styles.kioskStatusCard]}>
      <View style={styles.statusHeader}>
        <Icon name={icon} size={24} color={color} />
        <Text style={[styles.statusTitle, isKioskMode && styles.kioskText]}>{title}</Text>
      </View>
      <Text style={[styles.statusValue, isKioskMode && styles.kioskValue]}>{value}</Text>
      {subtitle && (
        <Text style={[styles.statusSubtitle, isKioskMode && styles.kioskSubtitle]}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  const WelcomeMessage = () => {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    else if (hour >= 17) greeting = 'Good evening';

    return (
      <View style={[styles.welcomeCard, isKioskMode && styles.kioskWelcomeCard]}>
        <Text style={[styles.welcomeText, isKioskMode && styles.kioskWelcomeText]}>
          {greeting}, {user?.first_name || 'Friend'}!
        </Text>
        <Text style={[styles.welcomeSubtext, isKioskMode && styles.kioskSubtext]}>
          How are you feeling today?
        </Text>
      </View>
    );
  };

  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  const todayCheckIn = dashboardData?.checkInStatus?.completedToday;
  const medicationCount = dashboardData?.medications?.totalActive || 0;
  const unreadMessages = dashboardData?.messages?.unreadCount || 0;
  const wellnessScore = dashboardData?.wellness?.overallScore;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        isKioskMode && styles.kioskContainer
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <WelcomeMessage />

      {/* Quick Actions */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, isKioskMode && styles.kioskSectionTitle]}>
          Quick Actions
        </Text>
        <View style={styles.quickActionsGrid}>
          <QuickActionCard
            title="Daily Check-In"
            icon={todayCheckIn ? "check-circle" : "radio-button-unchecked"}
            color={todayCheckIn ? "#10b981" : "#3b82f6"}
            onPress={() => navigation.navigate('CheckIn')}
            badge={!todayCheckIn ? "!" : null}
          />
          <QuickActionCard
            title="Medications"
            icon="medication"
            color="#8b5cf6"
            onPress={() => navigation.navigate('Medications')}
            badge={medicationCount > 0 ? medicationCount : null}
          />
          <QuickActionCard
            title="Messages"
            icon="message"
            color="#f59e0b"
            onPress={() => navigation.navigate('Messages')}
            badge={unreadMessages > 0 ? unreadMessages : null}
          />
          <QuickActionCard
            title="Emergency"
            icon="emergency"
            color="#dc2626"
            onPress={() => navigation.navigate('Emergency')}
          />
        </View>
      </View>

      {/* Health Status */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, isKioskMode && styles.kioskSectionTitle]}>
          Health Status
        </Text>
        <View style={styles.statusGrid}>
          <StatusCard
            title="Check-In Status"
            value={todayCheckIn ? "Completed" : "Pending"}
            subtitle={todayCheckIn ? "Great job!" : "Tap to complete"}
            icon="assignment-turned-in"
            color={todayCheckIn ? "#10b981" : "#f59e0b"}
          />
          <StatusCard
            title="Wellness Score"
            value={wellnessScore ? `${wellnessScore}/10` : "N/A"}
            subtitle={wellnessScore ? "Based on recent check-ins" : "Complete check-in"}
            icon="favorite"
            color="#ec4899"
          />
        </View>
        <View style={styles.statusGrid}>
          <StatusCard
            title="Active Medications"
            value={medicationCount.toString()}
            subtitle="Medications tracked"
            icon="medication"
            color="#8b5cf6"
          />
          <StatusCard
            title="Family Messages"
            value={unreadMessages.toString()}
            subtitle={unreadMessages === 1 ? "New message" : "New messages"}
            icon="family-restroom"
            color="#f59e0b"
          />
        </View>
      </View>

      {/* Recent Activity */}
      {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, isKioskMode && styles.kioskSectionTitle]}>
            Recent Activity
          </Text>
          {dashboardData.recentActivity.slice(0, 3).map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <Icon name="history" size={20} color="#6b7280" />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Daily Check-In</Text>
                <Text style={styles.activityDate}>
                  {new Date(activity.check_date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.activityScore}>
                <Text style={styles.scoreText}>
                  {activity.mood_rating}/5
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Emergency Contact */}
      {isKioskMode && (
        <View style={styles.emergencySection}>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => navigation.navigate('Emergency')}
          >
            <Icon name="emergency" size={32} color="#ffffff" />
            <Text style={styles.emergencyButtonText}>Emergency</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100, // Space for floating emergency button
  },
  kioskContainer: {
    padding: 24,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '500',
  },
  welcomeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  kioskWelcomeCard: {
    padding: 32,
    marginBottom: 32,
    borderRadius: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  kioskWelcomeText: {
    fontSize: 32,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#6b7280',
  },
  kioskSubtext: {
    fontSize: 20,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  kioskSectionTitle: {
    fontSize: 28,
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: (width - 48) / 2,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  kioskCard: {
    width: (width - 72) / 2,
    padding: 32,
    borderRadius: 16,
    marginBottom: 16,
  },
  cardIcon: {
    position: 'relative',
    marginBottom: 12,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  kioskText: {
    fontSize: 20,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusCard: {
    flex: 0.48,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  kioskStatusCard: {
    padding: 24,
    borderRadius: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  kioskValue: {
    fontSize: 28,
  },
  statusSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  kioskSubtitle: {
    fontSize: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  activityDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  activityScore: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  emergencySection: {
    alignItems: 'center',
    marginTop: 20,
  },
  emergencyButton: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    justifyContent: 'center',
  },
  emergencyButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
});

export default DashboardScreen;