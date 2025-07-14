const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { asyncHandler, ValidationError, AuthenticationError, ConflictError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().valid('senior', 'caregiver', 'admin').default('senior'),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  emergencyContacts: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    relationship: Joi.string().required(),
    isPrimary: Joi.boolean().default(false)
  })).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().default(false)
});

// Helper function to generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Helper function to verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
};

// Authentication middleware
const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!token) {
    throw new AuthenticationError('No token provided');
  }
  
  try {
    const decoded = verifyToken(token);
    const db = getDB();
    
    const user = await db.collection('users').findOne(
      { id: decoded.userId, is_active: true },
      { projection: { password_hash: 0 } }
    );
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Invalid token');
    }
    throw error;
  }
});

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const { email, password, firstName, lastName, role, phone, dateOfBirth, emergencyContacts } = value;
  const db = getDB();
  
  // Check if user already exists
  const existingUser = await db.collection('users').findOne({ email });
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user document
  const userId = uuidv4();
  const userDoc = {
    id: userId,
    email,
    password_hash: passwordHash,
    role: role || 'senior',
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null,
    profile_picture_url: null,
    subscription_tier: 'free',
    subscription_expires_at: null,
    emergency_contacts: emergencyContacts || [],
    preferences: {},
    is_active: true,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date()
  };

  await db.collection('users').insertOne(userDoc);

  // Generate token
  const token = generateToken({
    userId,
    email,
    role: role || 'senior'
  });

  delete userDoc.password_hash;
  logger.auth('User registered successfully', userId, { email, role });

  res.status(201).json({
    message: 'User registered successfully',
    user: userDoc,
    token
  });
}));
// Login user
router.post('/login', asyncHandler(async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const { email, password } = value;
  const db = getDB();
  
  // Find user
  const user = await db.collection('users').findOne({ email, is_active: true });
  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    logger.security('Failed login attempt', { email, ip: req.ip });
    throw new AuthenticationError('Invalid email or password');
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  delete user.password_hash;
  logger.auth('User logged in successfully', user.id, { email });

  res.json({
    message: 'Login successful',
    user,
    token
  });
}));

// Get user profile
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  res.json({
    user: req.user
  });
}));

// Logout user
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // For now, just send success (client should discard token)
  // TODO: Implement token blacklisting when Redis is available
  logger.auth('User logged out', req.user.id, { email: req.user.email });
  
  res.json({
    message: 'Logged out successfully'
  });
}));

module.exports = router;