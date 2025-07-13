const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp;

const initializeFirebase = async () => {
  try {
    // Check if Firebase service account is configured
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && !process.env.FIREBASE_PROJECT_ID) {
      logger.warn('Firebase not configured - skipping Firebase initialization');
      return null;
    }

    // Initialize Firebase Admin SDK
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else {
      try {
        serviceAccount = require('../config/firebase-service-account.json');
      } catch (error) {
        logger.warn('Firebase service account file not found - skipping Firebase initialization');
        return null;
      }
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('Firebase initialization failed:', error);
    // Don't throw error to allow app to continue without Firebase
    logger.warn('Continuing without Firebase - some features may be limited');
    return null;
  }
};

// Authentication helpers
const authHelpers = {
  // Verify Firebase ID token
  async verifyIdToken(idToken) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      logger.error('Error verifying Firebase ID token:', error);
      throw error;
    }
  },

  // Create custom token
  async createCustomToken(uid, additionalClaims = {}) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
      return customToken;
    } catch (error) {
      logger.error('Error creating custom token:', error);
      throw error;
    }
  },

  // Get user by email
  async getUserByEmail(email) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const userRecord = await admin.auth().getUserByEmail(email);
      return userRecord;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return null;
      }
      logger.error('Error getting user by email:', error);
      throw error;
    }
  },

  // Create user
  async createUser(userData) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const userRecord = await admin.auth().createUser(userData);
      return userRecord;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  },

  // Update user
  async updateUser(uid, userData) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const userRecord = await admin.auth().updateUser(uid, userData);
      return userRecord;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
  async deleteUser(uid) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      await admin.auth().deleteUser(uid);
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  },

  // Set custom user claims
  async setCustomUserClaims(uid, customClaims) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      await admin.auth().setCustomUserClaims(uid, customClaims);
      return true;
    } catch (error) {
      logger.error('Error setting custom user claims:', error);
      throw error;
    }
  }
};

// Push notification helpers
const messagingHelpers = {
  // Send notification to device
  async sendToDevice(registrationToken, notification, data = {}) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl || undefined
        },
        data: data,
        token: registrationToken,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
            defaultSound: true
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().send(message);
      logger.info('Successfully sent message:', response);
      return response;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  },

  // Send notification to multiple devices
  async sendToMultipleDevices(registrationTokens, notification, data = {}) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl || undefined
        },
        data: data,
        tokens: registrationTokens,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
            defaultSound: true
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().sendMulticast(message);
      logger.info(`Successfully sent ${response.successCount} messages`);
      
      if (response.failureCount > 0) {
        logger.warn(`${response.failureCount} messages failed`);
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            logger.error(`Error sending to token ${registrationTokens[idx]}:`, resp.error);
          }
        });
      }
      
      return response;
    } catch (error) {
      logger.error('Error sending notifications:', error);
      throw error;
    }
  },

  // Send notification to topic
  async sendToTopic(topic, notification, data = {}) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl || undefined
        },
        data: data,
        topic: topic,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
            defaultSound: true
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().send(message);
      logger.info('Successfully sent topic message:', response);
      return response;
    } catch (error) {
      logger.error('Error sending topic notification:', error);
      throw error;
    }
  },

  // Subscribe to topic
  async subscribeToTopic(registrationTokens, topic) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const response = await admin.messaging().subscribeToTopic(registrationTokens, topic);
      logger.info(`Successfully subscribed ${response.successCount} tokens to topic ${topic}`);
      return response;
    } catch (error) {
      logger.error('Error subscribing to topic:', error);
      throw error;
    }
  },

  // Unsubscribe from topic
  async unsubscribeFromTopic(registrationTokens, topic) {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized');
      }
      
      const response = await admin.messaging().unsubscribeFromTopic(registrationTokens, topic);
      logger.info(`Successfully unsubscribed ${response.successCount} tokens from topic ${topic}`);
      return response;
    } catch (error) {
      logger.error('Error unsubscribing from topic:', error);
      throw error;
    }
  }
};

// Medication reminder notifications
const medicationNotifications = {
  // Send medication reminder
  async sendMedicationReminder(userToken, medication, scheduledTime) {
    try {
      const notification = {
        title: '💊 Medication Reminder',
        body: `Time to take your ${medication.name} (${medication.dosage})`
      };

      const data = {
        type: 'medication_reminder',
        medicationId: medication.id,
        scheduledTime: scheduledTime.toISOString(),
        medicationName: medication.name,
        dosage: medication.dosage
      };

      return await messagingHelpers.sendToDevice(userToken, notification, data);
    } catch (error) {
      logger.error('Error sending medication reminder:', error);
      throw error;
    }
  },

  // Send missed medication alert
  async sendMissedMedicationAlert(caregiverTokens, senior, medication) {
    try {
      const notification = {
        title: '⚠️ Missed Medication Alert',
        body: `${senior.first_name} ${senior.last_name} missed their ${medication.name} medication`
      };

      const data = {
        type: 'missed_medication_alert',
        seniorId: senior.id,
        medicationId: medication.id,
        seniorName: `${senior.first_name} ${senior.last_name}`,
        medicationName: medication.name
      };

      return await messagingHelpers.sendToMultipleDevices(caregiverTokens, notification, data);
    } catch (error) {
      logger.error('Error sending missed medication alert:', error);
      throw error;
    }
  }
};

// Emergency notifications
const emergencyNotifications = {
  // Send emergency alert
  async sendEmergencyAlert(caregiverTokens, senior, alertType, message) {
    try {
      const notification = {
        title: `🚨 Emergency Alert - ${alertType}`,
        body: `${senior.first_name} ${senior.last_name}: ${message}`
      };

      const data = {
        type: 'emergency_alert',
        seniorId: senior.id,
        alertType: alertType,
        message: message,
        seniorName: `${senior.first_name} ${senior.last_name}`,
        timestamp: new Date().toISOString()
      };

      return await messagingHelpers.sendToMultipleDevices(caregiverTokens, notification, data);
    } catch (error) {
      logger.error('Error sending emergency alert:', error);
      throw error;
    }
  },

  // Send wellness anomaly alert
  async sendWellnessAnomalyAlert(caregiverTokens, senior, anomaly) {
    try {
      const notification = {
        title: '📊 Wellness Alert',
        body: `${senior.first_name} ${senior.last_name}: ${anomaly.description}`
      };

      const data = {
        type: 'wellness_anomaly_alert',
        seniorId: senior.id,
        anomaly: JSON.stringify(anomaly),
        seniorName: `${senior.first_name} ${senior.last_name}`,
        timestamp: new Date().toISOString()
      };

      return await messagingHelpers.sendToMultipleDevices(caregiverTokens, notification, data);
    } catch (error) {
      logger.error('Error sending wellness anomaly alert:', error);
      throw error;
    }
  }
};

// Health check function
const checkFirebaseHealth = async () => {
  try {
    if (!firebaseApp) {
      return false;
    }
    
    // Try to get project info
    await admin.auth().listUsers(1);
    return true;
  } catch (error) {
    logger.error('Firebase health check failed:', error);
    return false;
  }
};

module.exports = {
  initializeFirebase,
  authHelpers,
  messagingHelpers,
  medicationNotifications,
  emergencyNotifications,
  checkFirebaseHealth
};