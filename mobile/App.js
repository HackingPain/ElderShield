import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Alert,
  Linking,
  AppState,
  Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import MedicationsScreen from './src/screens/MedicationsScreen';
import EmergencyScreen from './src/screens/EmergencyScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoadingScreen from './src/screens/LoadingScreen';

// Import services
import AuthService from './src/services/AuthService';
import PushNotificationService from './src/services/PushNotificationService';
import EmergencyService from './src/services/EmergencyService';
import { store, persistor } from './src/store/store';

// Import components
import TabBarIcon from './src/components/TabBarIcon';
import EmergencyButton from './src/components/EmergencyButton';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon name={route.name} focused={focused} color={color} size={size} />
        ),
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          headerTitle: 'SeniorCare Hub',
        }}
      />
      <Tab.Screen 
        name="CheckIn" 
        component={CheckInScreen}
        options={{
          title: 'Check-In',
          headerTitle: 'Daily Check-In',
        }}
      />
      <Tab.Screen 
        name="Medications" 
        component={MedicationsScreen}
        options={{
          title: 'Medications',
          headerTitle: 'My Medications',
        }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen}
        options={{
          title: 'Messages',
          headerTitle: 'Family Messages',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
        }}
      />
    </Tab.Navigator>
  );
}

function App(): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [deviceInfo, setDeviceInfo] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Get device information
      const deviceData = {
        deviceId: DeviceInfo.getUniqueId(),
        brand: DeviceInfo.getBrand(),
        model: DeviceInfo.getModel(),
        systemVersion: DeviceInfo.getSystemVersion(),
        appVersion: DeviceInfo.getVersion(),
        isTablet: DeviceInfo.isTablet(),
        hasNotch: DeviceInfo.hasNotch(),
      };
      setDeviceInfo(deviceData);

      // Initialize services
      await AuthService.initialize();
      await PushNotificationService.initialize();
      await EmergencyService.initialize();

      // Check authentication status
      const token = await AuthService.getStoredToken();
      if (token && await AuthService.validateToken(token)) {
        setIsAuthenticated(true);
      }

      // Monitor network connectivity
      const unsubscribe = NetInfo.addEventListener(state => {
        setIsConnected(state.isConnected);
        if (!state.isConnected) {
          Alert.alert(
            'No Internet Connection',
            'Some features may not work offline. Emergency features remain available.',
            [{ text: 'OK' }]
          );
        }
      });

      // Handle app state changes
      const handleAppStateChange = (nextAppState) => {
        if (nextAppState === 'active') {
          // App became active - refresh data if needed
          if (isAuthenticated) {
            AuthService.refreshUserData();
          }
        }
      };
      
      AppState.addEventListener('change', handleAppStateChange);

      setIsLoading(false);

      return () => {
        unsubscribe();
        AppState.removeEventListener('change', handleAppStateChange);
      };
    } catch (error) {
      console.error('App initialization error:', error);
      setIsLoading(false);
      Alert.alert(
        'Initialization Error',
        'There was a problem starting the app. Please try again.',
        [
          {
            text: 'Retry',
            onPress: initializeApp,
          },
          {
            text: 'Emergency',
            onPress: () => Linking.openURL('tel:911'),
            style: 'destructive',
          },
        ]
      );
    }
  };

  const handleLogin = async (credentials) => {
    try {
      const success = await AuthService.login(credentials);
      if (success) {
        setIsAuthenticated(true);
        // Register for push notifications after login
        await PushNotificationService.registerForNotifications();
      }
      return success;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return <LoadingScreen deviceInfo={deviceInfo} />;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={<LoadingScreen />} persistor={persistor}>
        <SafeAreaView style={styles.container}>
          <StatusBar 
            barStyle="light-content" 
            backgroundColor="#2563eb"
            translucent={false}
          />
          
          <NavigationContainer>
            {isAuthenticated ? (
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Main" component={MainTabNavigator} />
                <Stack.Screen 
                  name="Emergency" 
                  component={EmergencyScreen}
                  options={{
                    headerShown: true,
                    headerTitle: 'Emergency',
                    headerStyle: { backgroundColor: '#dc2626' },
                    headerTintColor: '#ffffff',
                  }}
                />
              </Stack.Navigator>
            ) : (
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Login">
                  {props => (
                    <LoginScreen 
                      {...props} 
                      onLogin={handleLogin}
                      isConnected={isConnected}
                    />
                  )}
                </Stack.Screen>
              </Stack.Navigator>
            )}
          </NavigationContainer>

          {/* Global Emergency Button - Always Visible */}
          {isAuthenticated && (
            <EmergencyButton 
              style={styles.emergencyButton}
              onPress={() => EmergencyService.triggerEmergency()}
            />
          )}

          {/* Offline Indicator */}
          {!isConnected && (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>Offline Mode</Text>
            </View>
          )}
        </SafeAreaView>
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  emergencyButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    right: 20,
    zIndex: 1000,
  },
  offlineIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    alignItems: 'center',
    zIndex: 999,
  },
  offlineText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default App;