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

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  // Validate request
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
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

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

  // Insert user into database
  await db.collection('users').insertOne(userDoc);

  // Generate JWT token
  const tokenPayload = {
    userId: userId,
    email: email,
    role: role || 'senior'
  };
  
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'default-secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });

  // Remove password hash from response
  delete userDoc.password_hash;

  logger.auth('User registered successfully', userId, { email, role });

  res.status(201).json({
    message: 'User registered successfully',
    user: userDoc,
    token
  });
}));
    await client.query('BEGIN');

    const userResult = await client.query(`
      INSERT INTO users (
        email, password_hash, first_name, last_name, role, phone, 
        date_of_birth, emergency_contacts, subscription_tier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, first_name, last_name, role, phone, 
                date_of_birth, emergency_contacts, subscription_tier, 
                created_at
    `, [
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      phone || null,
      dateOfBirth || null,
      JSON.stringify(emergencyContacts || []),
      'free'
    ]);

    await client.query('COMMIT');

    const user = userResult.rows[0];

    // Generate JWT token
    const token = generateToken({ userId: user.id, role: user.role });

    // Create session
    await sessionHelpers.createSession(user.id, {
      userId: user.id,
      email: user.email,
      role: user.role,
      loginTime: new Date().toISOString()
    });

    // Log successful registration
    logger.auth('User registered successfully', user.id, {
      email: user.email,
      role: user.role,
      ip: req.ip
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        emergencyContacts: user.emergency_contacts,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  // Validate request
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const { email, password, rememberMe } = value;

  // Check rate limiting
  const rateLimitKey = `login_attempts:${req.ip}`;
  const attempts = await cacheHelpers.get(rateLimitKey) || 0;
  
  if (attempts >= 5) {
    logger.security('Too many login attempts', { ip: req.ip, email });
    throw new AuthenticationError('Too many login attempts. Please try again later.');
  }

  // Get user from database
  const userResult = await pool.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email]
  );

  if (userResult.rows.length === 0) {
    // Increment failed attempts
    await cacheHelpers.set(rateLimitKey, attempts + 1, 900); // 15 minutes
    logger.auth('Login failed - user not found', null, { email, ip: req.ip });
    throw new AuthenticationError('Invalid email or password');
  }

  const user = userResult.rows[0];

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    // Increment failed attempts
    await cacheHelpers.set(rateLimitKey, attempts + 1, 900); // 15 minutes
    logger.auth('Login failed - invalid password', user.id, { email, ip: req.ip });
    throw new AuthenticationError('Invalid email or password');
  }

  // Clear failed attempts
  await cacheHelpers.del(rateLimitKey);

  // Generate JWT token
  const tokenExpiry = rememberMe ? '30d' : '24h';
  const token = generateToken({ userId: user.id, role: user.role });

  // Create session
  await sessionHelpers.createSession(user.id, {
    userId: user.id,
    email: user.email,
    role: user.role,
    loginTime: new Date().toISOString(),
    rememberMe
  });

  // Update last login
  await pool.query(
    'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  // Log successful login
  logger.auth('User logged in successfully', user.id, {
    email: user.email,
    role: user.role,
    ip: req.ip,
    rememberMe
  });

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      phone: user.phone,
      dateOfBirth: user.date_of_birth,
      profilePictureUrl: user.profile_picture_url,
      subscriptionTier: user.subscription_tier,
      subscriptionExpiresAt: user.subscription_expires_at,
      emergencyContacts: user.emergency_contacts,
      preferences: user.preferences,
      emailVerified: user.email_verified
    },
    token
  });
}));

// Get current user profile
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const user = req.user;
  
  // Get additional user data
  const client = await pool.connect();
  try {
    // Get family connections
    const connectionsResult = await client.query(`
      SELECT 
        fc.*,
        CASE 
          WHEN fc.senior_id = $1 THEN 
            json_build_object(
              'id', c.id,
              'firstName', c.first_name,
              'lastName', c.last_name,
              'email', c.email,
              'phone', c.phone,
              'profilePictureUrl', c.profile_picture_url
            )
          ELSE 
            json_build_object(
              'id', s.id,
              'firstName', s.first_name,
              'lastName', s.last_name,
              'email', s.email,
              'phone', s.phone,
              'profilePictureUrl', s.profile_picture_url
            )
        END as connected_user
      FROM family_connections fc
      LEFT JOIN users s ON fc.senior_id = s.id
      LEFT JOIN users c ON fc.caregiver_id = c.id
      WHERE (fc.senior_id = $1 OR fc.caregiver_id = $1) AND fc.status = 'active'
    `, [user.id]);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        profilePictureUrl: user.profile_picture_url,
        subscriptionTier: user.subscription_tier,
        subscriptionExpiresAt: user.subscription_expires_at,
        emergencyContacts: user.emergency_contacts,
        preferences: user.preferences,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        familyConnections: connectionsResult.rows
      }
    });
  } finally {
    client.release();
  }
}));

// Update user profile
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const updateSchema = Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
    dateOfBirth: Joi.date().max('now').optional(),
    emergencyContacts: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().required(),
      relationship: Joi.string().required(),
      isPrimary: Joi.boolean().default(false)
    })).optional(),
    preferences: Joi.object().optional()
  });

  const { error, value } = updateSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const updateFields = [];
  const updateValues = [];
  let paramCount = 1;

  Object.keys(value).forEach(key => {
    if (value[key] !== undefined) {
      const dbKey = key === 'firstName' ? 'first_name' : 
                    key === 'lastName' ? 'last_name' :
                    key === 'dateOfBirth' ? 'date_of_birth' :
                    key === 'emergencyContacts' ? 'emergency_contacts' :
                    key;
      
      updateFields.push(`${dbKey} = $${paramCount}`);
      updateValues.push(
        key === 'emergencyContacts' || key === 'preferences' 
          ? JSON.stringify(value[key]) 
          : value[key]
      );
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw new ValidationError('No fields to update');
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(req.user.id);

  const query = `
    UPDATE users 
    SET ${updateFields.join(', ')} 
    WHERE id = $${paramCount}
    RETURNING id, email, first_name, last_name, role, phone, date_of_birth, 
              emergency_contacts, preferences, updated_at
  `;

  const result = await pool.query(query, updateValues);
  const updatedUser = result.rows[0];

  logger.audit('Profile updated', req.user.id, 'user', req.user.id, {
    updatedFields: Object.keys(value)
  });

  res.json({
    message: 'Profile updated successfully',
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      role: updatedUser.role,
      phone: updatedUser.phone,
      dateOfBirth: updatedUser.date_of_birth,
      emergencyContacts: updatedUser.emergency_contacts,
      preferences: updatedUser.preferences,
      updatedAt: updatedUser.updated_at
    }
  });
}));

// Change password
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const { currentPassword, newPassword } = value;

  // Get current password hash
  const userResult = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  );

  if (userResult.rows.length === 0) {
    throw new AuthenticationError('User not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
  if (!isCurrentPasswordValid) {
    logger.security('Invalid current password in change password attempt', {
      userId: req.user.id,
      email: req.user.email,
      ip: req.ip
    });
    throw new AuthenticationError('Current password is incorrect');
  }

  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newPasswordHash, req.user.id]
  );

  logger.security('Password changed successfully', {
    userId: req.user.id,
    email: req.user.email,
    ip: req.ip
  });

  res.json({
    message: 'Password changed successfully'
  });
}));

// Forgot password
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { error, value } = forgotPasswordSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const { email } = value;

  // Check if user exists
  const userResult = await pool.query(
    'SELECT id, first_name, last_name FROM users WHERE email = $1 AND is_active = true',
    [email]
  );

  // Always return success to prevent email enumeration
  if (userResult.rows.length === 0) {
    logger.security('Password reset requested for non-existent email', { email, ip: req.ip });
    return res.json({
      message: 'If an account with this email exists, you will receive a password reset link'
    });
  }

  const user = userResult.rows[0];

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

  // Store reset token
  await cacheHelpers.set(`password_reset:${resetToken}`, {
    userId: user.id,
    email: email,
    expiresAt: resetTokenExpiry.toISOString()
  }, 3600);

  // In a real application, you would send an email here
  // For now, we'll just log it
  logger.info('Password reset requested', {
    userId: user.id,
    email: email,
    resetToken: resetToken,
    ip: req.ip
  });

  res.json({
    message: 'If an account with this email exists, you will receive a password reset link',
    // In development, return the token for testing
    ...(process.env.NODE_ENV === 'development' && { resetToken })
  });
}));

// Reset password
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { error, value } = resetPasswordSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const { token, password } = value;

  // Get reset token data
  const tokenData = await cacheHelpers.get(`password_reset:${token}`);
  if (!tokenData) {
    throw new AuthenticationError('Invalid or expired reset token');
  }

  // Check if token is expired
  if (new Date(tokenData.expiresAt) < new Date()) {
    await cacheHelpers.del(`password_reset:${token}`);
    throw new AuthenticationError('Reset token has expired');
  }

  // Hash new password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Update password
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [passwordHash, tokenData.userId]
  );

  // Delete reset token
  await cacheHelpers.del(`password_reset:${token}`);

  logger.security('Password reset completed', {
    userId: tokenData.userId,
    email: tokenData.email,
    ip: req.ip
  });

  res.json({
    message: 'Password reset successful'
  });
}));

// Logout
router.post('/logout', authenticate, logout, asyncHandler(async (req, res) => {
  res.json({
    message: 'Logged out successfully'
  });
}));

// Verify email (placeholder - would integrate with email service)
router.post('/verify-email', authenticate, asyncHandler(async (req, res) => {
  await pool.query(
    'UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [req.user.id]
  );

  logger.auth('Email verified', req.user.id, { email: req.user.email });

  res.json({
    message: 'Email verified successfully'
  });
}));

// Refresh token
router.post('/refresh', authenticate, asyncHandler(async (req, res) => {
  // Generate new token
  const newToken = generateToken({ userId: req.user.id, role: req.user.role });

  // Update session
  await sessionHelpers.refreshSession(req.user.id);

  res.json({
    message: 'Token refreshed successfully',
    token: newToken
  });
}));

module.exports = router;