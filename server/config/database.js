const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'seniorcare_hub',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Return error after 5 seconds if connection could not be established
  statement_timeout: 60000, // Timeout statements after 1 minute
  query_timeout: 60000, // Timeout queries after 1 minute
});

// Initialize database schema
const initializeSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Enable UUID extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'senior',
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        date_of_birth DATE,
        profile_picture_url TEXT,
        subscription_tier VARCHAR(20) DEFAULT 'free',
        subscription_expires_at TIMESTAMP,
        emergency_contacts JSONB DEFAULT '[]',
        preferences JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Family connections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_connections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        senior_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        relationship VARCHAR(50) NOT NULL,
        permissions JSONB DEFAULT '{}',
        is_primary BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(senior_id, caregiver_id)
      )
    `);
    
    // Daily check-ins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_checkins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        check_date DATE NOT NULL,
        mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 5),
        energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
        sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
        meals_eaten INTEGER DEFAULT 0,
        water_intake INTEGER DEFAULT 0,
        medications_taken INTEGER DEFAULT 0,
        medications_total INTEGER DEFAULT 0,
        mobility_status VARCHAR(50),
        pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
        notes TEXT,
        voice_note_url TEXT,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, check_date)
      )
    `);
    
    // Medications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS medications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        dosage VARCHAR(100) NOT NULL,
        frequency VARCHAR(100) NOT NULL,
        times JSONB NOT NULL DEFAULT '[]',
        start_date DATE NOT NULL,
        end_date DATE,
        instructions TEXT,
        side_effects TEXT,
        prescribing_doctor VARCHAR(255),
        photo_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Medication logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS medication_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scheduled_time TIMESTAMP NOT NULL,
        taken_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        photo_confirmation_url TEXT,
        reminder_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_type VARCHAR(20) DEFAULT 'text',
        content TEXT NOT NULL,
        attachment_url TEXT,
        is_read BOOLEAN DEFAULT false,
        is_encrypted BOOLEAN DEFAULT true,
        encryption_key TEXT,
        reply_to_id UUID REFERENCES messages(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      )
    `);
    
    // Vitals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vitals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        measurement_type VARCHAR(50) NOT NULL,
        value DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        device_id VARCHAR(100),
        device_type VARCHAR(50),
        measured_at TIMESTAMP NOT NULL,
        is_normal BOOLEAN,
        alert_triggered BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Journal entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entry_type VARCHAR(20) DEFAULT 'note',
        title VARCHAR(255),
        content TEXT,
        voice_note_url TEXT,
        photo_urls JSONB DEFAULT '[]',
        is_shared BOOLEAN DEFAULT false,
        shared_with JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Appointments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        appointment_date TIMESTAMP NOT NULL,
        duration INTEGER DEFAULT 60,
        location VARCHAR(255),
        doctor_name VARCHAR(255),
        appointment_type VARCHAR(50),
        reminder_sent BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Emergency alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS emergency_alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        location JSONB,
        contacts_notified JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'active',
        acknowledged_at TIMESTAMP,
        acknowledged_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Wellness scores table (AI-powered)
    await client.query(`
      CREATE TABLE IF NOT EXISTS wellness_scores (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
        factors JSONB NOT NULL DEFAULT '{}',
        anomalies JSONB DEFAULT '[]',
        recommendations JSONB DEFAULT '[]',
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_family_connections_senior ON family_connections(senior_id);
      CREATE INDEX IF NOT EXISTS idx_family_connections_caregiver ON family_connections(caregiver_id);
      CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON daily_checkins(user_id, check_date);
      CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id);
      CREATE INDEX IF NOT EXISTS idx_medication_logs_user ON medication_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_vitals_user ON vitals(user_id);
      CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id);
      CREATE INDEX IF NOT EXISTS idx_emergency_alerts_user ON emergency_alerts(user_id);
      CREATE INDEX IF NOT EXISTS idx_wellness_scores_user ON wellness_scores(user_id);
    `);
    
    await client.query('COMMIT');
    logger.info('Database schema initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error initializing database schema:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Database connection function
const connectDB = async () => {
  try {
    await pool.connect();
    logger.info('Connected to PostgreSQL database');
    
    // Initialize schema on first connection
    await initializeSchema();
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Health check function
const checkDBHealth = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

module.exports = {
  pool,
  connectDB,
  checkDBHealth
};