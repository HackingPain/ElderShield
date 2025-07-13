const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { messagingHelpers, emergencyNotifications } = require('../config/firebase');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const emergencyAlertSchema = Joi.object({
  alert_type: Joi.string().valid('manual', 'fall_detection', 'medication_missed', 'vitals_abnormal', 'panic_button').required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('high'),
  message: Joi.string().min(1).max(1000).required(),
  location_data: Joi.object({
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    address: Joi.string().max(500).optional(),
    accuracy: Joi.number().positive().optional()
  }).optional(),
  vitals_data: Joi.object().optional()
});

/**
 * @route POST /api/emergency/alert
 * @desc Create emergency alert
 * @access Private
 */
router.post('/alert', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = emergencyAlertSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const userId = req.user.id;
  const { alert_type, severity, message, location_data, vitals_data } = value;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create emergency alert
    const alertResult = await client.query(
      `INSERT INTO emergency_alerts 
       (user_id, alert_type, severity, message, location_data, vitals_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, alert_type, severity, message, 
       JSON.stringify(location_data || {}), JSON.stringify(vitals_data || {})]
    );

    const alert = alertResult.rows[0];

    // Get emergency contacts and caregivers
    const contacts = await client.query(
      `SELECT DISTINCT
        u.id, u.first_name, u.last_name, u.email, u.phone,
        'caregiver' as contact_type
       FROM users u
       JOIN family_connections fc ON u.id = fc.caregiver_id
       WHERE fc.senior_id = $1 AND fc.status = 'active'
       
       UNION
       
       SELECT DISTINCT
        NULL as id, ec.name as first_name, '' as last_name, 
        NULL as email, ec.phone, 'emergency_contact' as contact_type
       FROM users u, jsonb_array_elements(u.emergency_contacts) as ec
       WHERE u.id = $1 AND ec->>'isPrimary' = 'true'`,
      [userId]
    );

    // Send notifications to all contacts
    const notificationPromises = [];
    const caregiverTokens = []; // This would come from user device tokens in real implementation

    for (const contact of contacts.rows) {
      if (contact.contact_type === 'caregiver' && contact.id) {
        // Send push notification to caregiver
        notificationPromises.push(
          emergencyNotifications.sendEmergencyAlert(
            [contact.id], // This would be their device token
            req.user,
            alert_type,
            message
          ).catch(err => logger.error('Failed to send emergency notification:', err))
        );

        // Send emergency message
        const conversationId = [userId, contact.id].sort().join('-');
        await client.query(
          `INSERT INTO messages 
           (conversation_id, sender_id, recipient_id, message_text, message_type)
           VALUES ($1, $2, $3, $4, 'emergency')`,
          [conversationId, userId, contact.id, `🚨 EMERGENCY: ${message}`]
        );
      }

      // Log contact notification
      await client.query(
        `UPDATE emergency_alerts 
         SET contacts_notified = contacts_notified || $1
         WHERE id = $2`,
        [JSON.stringify([{
          type: contact.contact_type,
          name: `${contact.first_name} ${contact.last_name}`.trim(),
          phone: contact.phone,
          notified_at: new Date().toISOString()
        }]), alert.id]
      );
    }

    await client.query('COMMIT');

    // Execute notifications (don't wait for completion)
    Promise.all(notificationPromises);

    // If no contacts found, log warning
    if (contacts.rows.length === 0) {
      logger.warn(`Emergency alert created but no contacts found for user ${userId}`);
    }

    logger.info(`Emergency alert created: ${alert.id} for user ${userId}, type: ${alert_type}`);

    res.status(201).json({
      message: 'Emergency alert created and notifications sent',
      alert: {
        id: alert.id,
        alertType: alert.alert_type,
        severity: alert.severity,
        message: alert.message,
        createdAt: alert.created_at,
        contactsNotified: contacts.rows.length
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
 * @route GET /api/emergency/alerts
 * @desc Get emergency alerts for user
 * @access Private
 */
router.get('/alerts', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, status = 'all' } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE user_id = $1';
  let params = [userId];

  if (status !== 'all') {
    params.push(status);
    whereClause += ` AND status = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT 
      id, user_id, alert_type, severity, message, location_data,
      vitals_data, status, contacts_notified, acknowledged_by,
      acknowledged_at, resolved_at, created_at
     FROM emergency_alerts 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM emergency_alerts ${whereClause}`,
    params
  );

  res.json({
    alerts: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(countResult.rows[0].total),
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    }
  });
}));

/**
 * @route POST /api/emergency/alerts/:id/acknowledge
 * @desc Acknowledge emergency alert
 * @access Private
 */
router.post('/alerts/:id/acknowledge', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Check if user has access to this alert (either owner or caregiver)
  const alertResult = await pool.query(
    `SELECT ea.*, u.first_name, u.last_name
     FROM emergency_alerts ea
     JOIN users u ON ea.user_id = u.id
     LEFT JOIN family_connections fc ON ea.user_id = fc.senior_id AND fc.caregiver_id = $2
     WHERE ea.id = $1 
     AND (ea.user_id = $2 OR fc.id IS NOT NULL)`,
    [id, userId]
  );

  if (alertResult.rows.length === 0) {
    return res.status(404).json({ error: 'Alert not found or access denied' });
  }

  const alert = alertResult.rows[0];

  if (alert.status !== 'active') {
    return res.status(400).json({ error: 'Alert is not active' });
  }

  const result = await pool.query(
    `UPDATE emergency_alerts 
     SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [userId, id]
  );

  logger.info(`Emergency alert ${id} acknowledged by user ${userId}`);

  res.json({
    message: 'Alert acknowledged successfully',
    alert: result.rows[0]
  });
}));

/**
 * @route POST /api/emergency/alerts/:id/resolve
 * @desc Resolve emergency alert
 * @access Private
 */
router.post('/alerts/:id/resolve', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Check if user has access to this alert
  const alertResult = await pool.query(
    `SELECT ea.*
     FROM emergency_alerts ea
     LEFT JOIN family_connections fc ON ea.user_id = fc.senior_id AND fc.caregiver_id = $2
     WHERE ea.id = $1 
     AND (ea.user_id = $2 OR fc.id IS NOT NULL)`,
    [id, userId]
  );

  if (alertResult.rows.length === 0) {
    return res.status(404).json({ error: 'Alert not found or access denied' });
  }

  const alert = alertResult.rows[0];

  if (alert.status === 'resolved') {
    return res.status(400).json({ error: 'Alert is already resolved' });
  }

  const result = await pool.query(
    `UPDATE emergency_alerts 
     SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  logger.info(`Emergency alert ${id} resolved by user ${userId}`);

  res.json({
    message: 'Alert resolved successfully',
    alert: result.rows[0]
  });
}));

/**
 * @route GET /api/emergency/contacts
 * @desc Get emergency contacts for user
 * @access Private
 */
router.get('/contacts', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await pool.query(
    'SELECT emergency_contacts FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const emergencyContacts = result.rows[0].emergency_contacts || [];

  res.json({
    emergencyContacts
  });
}));

/**
 * @route PUT /api/emergency/contacts
 * @desc Update emergency contacts
 * @access Private
 */
router.put('/contacts', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { emergencyContacts } = req.body;

  const contactSchema = Joi.array().items(Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).required(),
    relationship: Joi.string().min(2).max(50).required(),
    isPrimary: Joi.boolean().default(false),
    email: Joi.string().email().optional()
  })).max(10);

  const { error, value } = contactSchema.validate(emergencyContacts);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  // Ensure only one primary contact
  const primaryContacts = value.filter(contact => contact.isPrimary);
  if (primaryContacts.length > 1) {
    return res.status(400).json({ error: 'Only one primary contact is allowed' });
  }

  const result = await pool.query(
    `UPDATE users 
     SET emergency_contacts = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING emergency_contacts`,
    [JSON.stringify(value), userId]
  );

  logger.info(`Emergency contacts updated for user ${userId}`);

  res.json({
    message: 'Emergency contacts updated successfully',
    emergencyContacts: result.rows[0].emergency_contacts
  });
}));

/**
 * @route POST /api/emergency/test-alert
 * @desc Send test emergency alert (for testing notification system)
 * @access Private
 */
router.post('/test-alert', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get caregivers for test notification
  const caregivers = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email
     FROM users u
     JOIN family_connections fc ON u.id = fc.caregiver_id
     WHERE fc.senior_id = $1 AND fc.status = 'active'`,
    [userId]
  );

  if (caregivers.rows.length === 0) {
    return res.status(400).json({ error: 'No caregivers found to send test alert' });
  }

  // Send test notifications
  const testMessage = 'This is a test emergency alert. No action required.';
  
  try {
    await emergencyNotifications.sendEmergencyAlert(
      [], // Device tokens would go here
      req.user,
      'manual',
      testMessage
    );

    logger.info(`Test emergency alert sent by user ${userId}`);

    res.json({
      message: 'Test alert sent successfully',
      sentTo: caregivers.rows.map(c => `${c.first_name} ${c.last_name}`)
    });

  } catch (error) {
    logger.error('Failed to send test emergency alert:', error);
    res.status(500).json({ error: 'Failed to send test alert' });
  }
}));

/**
 * @route GET /api/emergency/panic-button-status
 * @desc Get panic button status and settings
 * @access Private
 */
router.get('/panic-button-status', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get user preferences for panic button
  const result = await pool.query(
    'SELECT preferences FROM users WHERE id = $1',
    [userId]
  );

  const preferences = result.rows[0]?.preferences || {};
  const panicButtonSettings = preferences.panicButton || {
    enabled: true,
    autoLocation: true,
    soundAlert: true,
    vibration: true
  };

  res.json({
    panicButtonSettings,
    isEnabled: panicButtonSettings.enabled
  });
}));

/**
 * @route PUT /api/emergency/panic-button-settings
 * @desc Update panic button settings
 * @access Private
 */
router.put('/panic-button-settings', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { settings } = req.body;

  const settingsSchema = Joi.object({
    enabled: Joi.boolean().required(),
    autoLocation: Joi.boolean().default(true),
    soundAlert: Joi.boolean().default(true),
    vibration: Joi.boolean().default(true),
    confirmationRequired: Joi.boolean().default(false)
  });

  const { error, value } = settingsSchema.validate(settings);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  // Update user preferences
  const result = await pool.query(
    `UPDATE users 
     SET preferences = COALESCE(preferences, '{}') || $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING preferences`,
    [JSON.stringify({ panicButton: value }), userId]
  );

  logger.info(`Panic button settings updated for user ${userId}`);

  res.json({
    message: 'Panic button settings updated successfully',
    settings: result.rows[0].preferences.panicButton
  });
}));

module.exports = router;