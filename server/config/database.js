const { MongoClient } = require('mongodb');
const logger = require('../utils/logger');

let db = null;
let client = null;

// MongoDB connection function
const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/seniorcare_hub';
    
    client = new MongoClient(mongoUrl, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    db = client.db();
    
    logger.info('Connected to MongoDB database');
    
    // Initialize collections and indexes
    await initializeCollections();
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Initialize MongoDB collections and indexes
const initializeCollections = async () => {
  try {
    // Create collections if they don't exist and set up indexes
    
    // Users collection
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ role: 1 });
    
    // Family connections collection
    const familyConnectionsCollection = db.collection('family_connections');
    await familyConnectionsCollection.createIndex({ senior_id: 1 });
    await familyConnectionsCollection.createIndex({ caregiver_id: 1 });
    await familyConnectionsCollection.createIndex({ senior_id: 1, caregiver_id: 1 }, { unique: true });
    
    // Daily check-ins collection
    const checkInsCollection = db.collection('daily_checkins');
    await checkInsCollection.createIndex({ user_id: 1, check_date: 1 }, { unique: true });
    
    // Medications collection
    const medicationsCollection = db.collection('medications');
    await medicationsCollection.createIndex({ user_id: 1 });
    
    // Medication logs collection
    const medicationLogsCollection = db.collection('medication_logs');
    await medicationLogsCollection.createIndex({ user_id: 1 });
    await medicationLogsCollection.createIndex({ medication_id: 1 });
    
    // Messages collection
    const messagesCollection = db.collection('messages');
    await messagesCollection.createIndex({ recipient_id: 1 });
    await messagesCollection.createIndex({ sender_id: 1 });
    
    // Vitals collection
    const vitalsCollection = db.collection('vitals');
    await vitalsCollection.createIndex({ user_id: 1 });
    
    // Journal entries collection
    const journalCollection = db.collection('journal_entries');
    await journalCollection.createIndex({ user_id: 1 });
    
    // Appointments collection
    const appointmentsCollection = db.collection('appointments');
    await appointmentsCollection.createIndex({ user_id: 1 });
    
    // Emergency alerts collection
    const emergencyAlertsCollection = db.collection('emergency_alerts');
    await emergencyAlertsCollection.createIndex({ user_id: 1 });
    
    // Wellness scores collection
    const wellnessScoresCollection = db.collection('wellness_scores');
    await wellnessScoresCollection.createIndex({ user_id: 1 });
    
    logger.info('MongoDB collections and indexes initialized successfully');
  } catch (error) {
    logger.error('Error initializing MongoDB collections:', error);
    throw error;
  }
};

// Health check function
const checkDBHealth = async () => {
  try {
    if (!client) {
      return false;
    }
    await client.db('admin').command({ ping: 1 });
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

// Get database instance
const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
};

// Graceful shutdown
const closeDB = async () => {
  try {
    if (client) {
      await client.close();
      logger.info('MongoDB connection closed');
    }
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
  }
};

module.exports = {
  connectDB,
  checkDBHealth,
  getDB,
  closeDB
};