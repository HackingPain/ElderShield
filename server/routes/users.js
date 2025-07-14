const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, ForbiddenError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

// Validation schemas
const familyConnectionSchema = Joi.object({
  senior_email: Joi.string().email(),
  caregiver_email: Joi.string().email(),
  relationship: Joi.string().min(2).max(50).required(),
  permissions: Joi.object({
    viewCheckIns: Joi.boolean().default(true),
    viewMedications: Joi.boolean().default(true),
    viewVitals: Joi.boolean().default(true),
    viewMessages: Joi.boolean().default(true),
    receiveAlerts: Joi.boolean().default(true),
    emergencyContact: Joi.boolean().default(true)
  }).default({})
});

/**
 * @route GET /api/users/family-connections
 * @desc Get family connections for authenticated user
 * @access Private
 */
router.get('/family-connections', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  let query, params;

  if (userRole === 'senior') {
    // Get all caregivers connected to this senior
    query = `
      SELECT 
        fc.id, fc.relationship, fc.permissions, fc.status, fc.created_at,
        u.id as user_id, u.first_name, u.last_name, u.email, u.phone,
        u.profile_picture_url, u.role, 'caregiver' as connection_type
      FROM family_connections fc
      JOIN users u ON fc.caregiver_id = u.id
      WHERE fc.senior_id = $1
      ORDER BY fc.created_at DESC
    `;
    params = [userId];
  } else if (userRole === 'caregiver') {
    // Get all seniors this caregiver is connected to
    query = `
      SELECT 
        fc.id, fc.relationship, fc.permissions, fc.status, fc.created_at,
        u.id as user_id, u.first_name, u.last_name, u.email, u.phone,
        u.profile_picture_url, u.role, 'senior' as connection_type
      FROM family_connections fc
      JOIN users u ON fc.senior_id = u.id
      WHERE fc.caregiver_id = $1
      ORDER BY fc.created_at DESC
    `;
    params = [userId];
  } else {
    // Admin can see all connections
    query = `
      SELECT 
        fc.id, fc.senior_id, fc.caregiver_id, fc.relationship, 
        fc.permissions, fc.status, fc.created_at,
        s.first_name as senior_first_name, s.last_name as senior_last_name,
        c.first_name as caregiver_first_name, c.last_name as caregiver_last_name
      FROM family_connections fc
      JOIN users s ON fc.senior_id = s.id
      JOIN users c ON fc.caregiver_id = c.id
      ORDER BY fc.created_at DESC
      LIMIT 100
    `;
    params = [];
  }

  const result = await pool.query(query, params);

  res.json({
    connections: result.rows
  });
}));

/**
 * @route POST /api/users/invite-family-member
 * @desc Invite a family member to connect
 * @access Private
 */
router.post('/invite-family-member', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = familyConnectionSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const inviterId = req.user.id;
  const inviterRole = req.user.role;
  const { senior_email, caregiver_email, relationship, permissions } = value;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let seniorId, caregiverId, inviteeEmail;

    if (inviterRole === 'senior') {
      // Senior is inviting a caregiver
      seniorId = inviterId;
      inviteeEmail = caregiver_email;
      
      // Check if caregiver exists, if not create account
      let caregiverResult = await client.query(
        'SELECT id, first_name, last_name FROM users WHERE email = $1',
        [caregiver_email]
      );

      if (caregiverResult.rows.length === 0) {
        // Create pending caregiver account
        caregiverResult = await client.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
           VALUES ($1, 'PENDING', 'Pending', 'User', 'caregiver', false)
           RETURNING id, first_name, last_name`,
          [caregiver_email]
        );
      }

      caregiverId = caregiverResult.rows[0].id;
    } else if (inviterRole === 'caregiver') {
      // Caregiver is requesting to connect to a senior
      caregiverId = inviterId;
      inviteeEmail = senior_email;
      
      // Senior must already exist
      const seniorResult = await client.query(
        'SELECT id, first_name, last_name FROM users WHERE email = $1 AND role = $2',
        [senior_email, 'senior']
      );

      if (seniorResult.rows.length === 0) {
        throw new ValidationError('Senior with this email not found');
      }

      seniorId = seniorResult.rows[0].id;
    } else {
      throw new ForbiddenError('Only seniors and caregivers can create family connections');
    }

    // Check if connection already exists
    const existingConnection = await client.query(
      'SELECT id, status FROM family_connections WHERE senior_id = $1 AND caregiver_id = $2',
      [seniorId, caregiverId]
    );

    if (existingConnection.rows.length > 0) {
      if (existingConnection.rows[0].status === 'active') {
        throw new ValidationError('Family connection already exists');
      } else {
        // Reactivate existing connection
        await client.query(
          `UPDATE family_connections 
           SET status = 'pending', relationship = $1, permissions = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [relationship, JSON.stringify(permissions), existingConnection.rows[0].id]
        );
      }
    } else {
      // Create new family connection
      await client.query(
        `INSERT INTO family_connections 
         (senior_id, caregiver_id, relationship, permissions, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [seniorId, caregiverId, relationship, JSON.stringify(permissions)]
      );
    }

    await client.query('COMMIT');

    // Send invitation email/notification to invitee
    try {
      const inviterName = `${req.user.first_name} ${req.user.last_name}`;
      const subject = `Family Connection Invitation - SeniorCare Hub`;
      const message = `${inviterName} has invited you to connect on SeniorCare Hub as their ${relationship}.`;
      
      // This would integrate with your email service
      logger.info(`Family connection invitation sent to ${inviteeEmail} from ${inviterName}`);
    } catch (emailError) {
      logger.error('Failed to send invitation email:', emailError);
    }

    logger.info(`Family connection invitation created: ${inviterRole} ${inviterId} inviting ${inviteeEmail}`);

    res.status(201).json({
      message: 'Family member invitation sent successfully',
      inviteeEmail,
      relationship,
      status: 'pending'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * @route POST /api/users/family-connections/:connectionId/accept
 * @desc Accept a family connection invitation
 * @access Private
 */
router.post('/family-connections/:connectionId/accept', authenticate, asyncHandler(async (req, res) => {
  const { connectionId } = req.params;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get connection details
    const connection = await client.query(
      `SELECT fc.*, s.first_name as senior_name, c.first_name as caregiver_name
       FROM family_connections fc
       JOIN users s ON fc.senior_id = s.id
       JOIN users c ON fc.caregiver_id = c.id
       WHERE fc.id = $1 AND (fc.senior_id = $2 OR fc.caregiver_id = $2)
       AND fc.status = 'pending'`,
      [connectionId, userId]
    );

    if (connection.rows.length === 0) {
      return res.status(404).json({ error: 'Connection invitation not found or already processed' });
    }

    const conn = connection.rows[0];

    // Update connection status to active
    await client.query(
      'UPDATE family_connections SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['active', connectionId]
    );

    // If the caregiver was a pending user, activate their account
    if (conn.caregiver_id === userId) {
      await client.query(
        'UPDATE users SET is_active = true WHERE id = $1 AND is_active = false',
        [userId]
      );
    }

    await client.query('COMMIT');

    logger.info(`Family connection accepted: ${connectionId} by user ${userId}`);

    res.json({
      message: 'Family connection accepted successfully',
      connection: {
        id: conn.id,
        relationship: conn.relationship,
        status: 'active'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * @route POST /api/users/family-connections/:connectionId/decline
 * @desc Decline a family connection invitation
 * @access Private
 */
router.post('/family-connections/:connectionId/decline', authenticate, asyncHandler(async (req, res) => {
  const { connectionId } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    `UPDATE family_connections 
     SET status = 'declined', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1 AND (senior_id = $2 OR caregiver_id = $2) AND status = 'pending'
     RETURNING *`,
    [connectionId, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Connection invitation not found or already processed' });
  }

  logger.info(`Family connection declined: ${connectionId} by user ${userId}`);

  res.json({
    message: 'Family connection declined'
  });
}));

/**
 * @route PUT /api/users/family-connections/:connectionId/permissions
 * @desc Update permissions for a family connection
 * @access Private
 */
router.put('/family-connections/:connectionId/permissions', authenticate, asyncHandler(async (req, res) => {
  const { connectionId } = req.params;
  const userId = req.user.id;
  const { permissions } = req.body;

  const permissionsSchema = Joi.object({
    viewCheckIns: Joi.boolean().optional(),
    viewMedications: Joi.boolean().optional(),
    viewVitals: Joi.boolean().optional(),
    viewMessages: Joi.boolean().optional(),
    receiveAlerts: Joi.boolean().optional(),
    emergencyContact: Joi.boolean().optional()
  });

  const { error, value } = permissionsSchema.validate(permissions);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  // Only the senior can update caregiver permissions
  const result = await pool.query(
    `UPDATE family_connections 
     SET permissions = permissions || $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND senior_id = $3 AND status = 'active'
     RETURNING *`,
    [JSON.stringify(value), connectionId, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Connection not found or not authorized' });
  }

  logger.info(`Family connection permissions updated: ${connectionId} by user ${userId}`);

  res.json({
    message: 'Permissions updated successfully',
    permissions: result.rows[0].permissions
  });
}));

/**
 * @route DELETE /api/users/family-connections/:connectionId
 * @desc Remove a family connection
 * @access Private
 */
router.delete('/family-connections/:connectionId', authenticate, asyncHandler(async (req, res) => {
  const { connectionId } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    `UPDATE family_connections 
     SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND (senior_id = $2 OR caregiver_id = $2)
     RETURNING *`,
    [connectionId, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Connection not found' });
  }

  logger.info(`Family connection removed: ${connectionId} by user ${userId}`);

  res.json({
    message: 'Family connection removed successfully'
  });
}));

/**
 * @route GET /api/users/search
 * @desc Search for users (for admin or caregiver use)
 * @access Private
 */
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const { query, role, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  // Only admins and caregivers can search for users
  if (req.user.role !== 'admin' && req.user.role !== 'caregiver') {
    throw new ForbiddenError('Not authorized to search users');
  }

  let whereClause = `WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1) AND is_active = true`;
  let params = [`%${query}%`];

  if (role) {
    params.push(role);
    whereClause += ` AND role = $${params.length}`;
  }

  // Caregivers can only search for seniors
  if (req.user.role === 'caregiver') {
    whereClause += ` AND role = 'senior'`;
  }

  const result = await pool.query(
    `SELECT 
      id, first_name, last_name, email, role, profile_picture_url, created_at
     FROM users 
     ${whereClause}
     ORDER BY first_name, last_name
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.json({
    users: result.rows,
    query,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit)
    }
  });
}));

/**
 * @route GET /api/users/:userId/profile
 * @desc Get user profile (for family members)
 * @access Private
 */
router.get('/:userId/profile', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const requesterId = req.user.id;

  // Check if requester has access to this user's profile
  if (userId !== requesterId) {
    const accessCheck = await pool.query(
      `SELECT fc.id 
       FROM family_connections fc
       WHERE ((fc.senior_id = $1 AND fc.caregiver_id = $2) OR 
              (fc.senior_id = $2 AND fc.caregiver_id = $1))
       AND fc.status = 'active'`,
      [userId, requesterId]
    );

    if (accessCheck.rows.length === 0 && req.user.role !== 'admin') {
      throw new ForbiddenError('Not authorized to view this profile');
    }
  }

  const result = await pool.query(
    `SELECT 
      id, first_name, last_name, email, phone, date_of_birth,
      profile_picture_url, role, subscription_tier, created_at
     FROM users 
     WHERE id = $1 AND is_active = true`,
    [userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: result.rows[0]
  });
}));

module.exports = router;