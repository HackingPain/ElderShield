const express = require('express');
const Joi = require('joi');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { messagingHelpers } = require('../config/firebase');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const messageSchema = Joi.object({
  recipient_id: Joi.string().uuid().required(),
  message_text: Joi.string().max(5000).when('voice_message_url', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  voice_message_url: Joi.string().uri().optional(),
  attachments: Joi.array().items(Joi.object({
    url: Joi.string().uri().required(),
    type: Joi.string().valid('image', 'document', 'audio').required(),
    filename: Joi.string().required(),
    size: Joi.number().integer().positive().required()
  })).max(5).optional(),
  message_type: Joi.string().valid('text', 'voice', 'image', 'emergency').default('text'),
  reply_to_id: Joi.string().uuid().optional()
});

/**
 * @route GET /api/messaging/conversations
 * @desc Get all conversations for authenticated user
 * @access Private
 */
router.get('/conversations', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `SELECT DISTINCT
      CASE 
        WHEN m.sender_id = $1 THEN m.recipient_id 
        ELSE m.sender_id 
      END as other_user_id,
      CASE 
        WHEN m.sender_id = $1 THEN recipient.first_name 
        ELSE sender.first_name 
      END as first_name,
      CASE 
        WHEN m.sender_id = $1 THEN recipient.last_name 
        ELSE sender.last_name 
      END as last_name,
      CASE 
        WHEN m.sender_id = $1 THEN recipient.profile_picture_url 
        ELSE sender.profile_picture_url 
      END as profile_picture_url,
      latest.message_text as last_message,
      latest.message_type as last_message_type,
      latest.created_at as last_message_time,
      latest.sender_id as last_sender_id,
      unread.unread_count
    FROM messages m
    LEFT JOIN users sender ON m.sender_id = sender.id
    LEFT JOIN users recipient ON m.recipient_id = recipient.id
    LEFT JOIN LATERAL (
      SELECT message_text, message_type, created_at, sender_id
      FROM messages m2 
      WHERE (m2.sender_id = m.sender_id AND m2.recipient_id = m.recipient_id) 
         OR (m2.sender_id = m.recipient_id AND m2.recipient_id = m.sender_id)
      ORDER BY created_at DESC 
      LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as unread_count
      FROM messages m3
      WHERE m3.recipient_id = $1 
      AND m3.read_at IS NULL
      AND ((m3.sender_id = m.sender_id AND m3.recipient_id = m.recipient_id) 
           OR (m3.sender_id = m.recipient_id AND m3.recipient_id = m.sender_id))
    ) unread ON true
    WHERE (m.sender_id = $1 OR m.recipient_id = $1)
    AND m.deleted_by_sender = false 
    AND m.deleted_by_recipient = false
    ORDER BY latest.created_at DESC
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  res.json({
    conversations: result.rows.map(row => ({
      otherUserId: row.other_user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      profilePictureUrl: row.profile_picture_url,
      lastMessage: row.last_message,
      lastMessageType: row.last_message_type,
      lastMessageTime: row.last_message_time,
      lastSenderId: row.last_sender_id,
      unreadCount: parseInt(row.unread_count) || 0
    }))
  });
}));

/**
 * @route GET /api/messaging/conversations/:userId
 * @desc Get messages in a conversation with specific user
 * @access Private
 */
router.get('/conversations/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId: otherUserId } = req.params;
  const currentUserId = req.user.id;
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  // Verify the other user exists and is connected
  const otherUser = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.profile_picture_url, u.role
     FROM users u
     LEFT JOIN family_connections fc ON 
       (fc.senior_id = u.id AND fc.caregiver_id = $1) OR 
       (fc.caregiver_id = u.id AND fc.senior_id = $1)
     WHERE u.id = $2 AND u.is_active = true
     AND (fc.status = 'active' OR u.role = 'admin')`,
    [currentUserId, otherUserId]
  );

  if (otherUser.rows.length === 0) {
    return res.status(403).json({ error: 'Not authorized to message this user' });
  }

  // Get messages between these two users
  const messages = await pool.query(
    `SELECT 
      id, sender_id, recipient_id, message_text, voice_message_url,
      attachments, message_type, read_at, created_at,
      sender.first_name as sender_first_name,
      sender.last_name as sender_last_name,
      sender.profile_picture_url as sender_profile_picture
    FROM messages m
    LEFT JOIN users sender ON m.sender_id = sender.id
    WHERE ((m.sender_id = $1 AND m.recipient_id = $2) OR 
           (m.sender_id = $2 AND m.recipient_id = $1))
    AND m.deleted_by_sender = false 
    AND m.deleted_by_recipient = false
    ORDER BY m.created_at DESC
    LIMIT $3 OFFSET $4`,
    [currentUserId, otherUserId, limit, offset]
  );

  // Mark messages as read
  await pool.query(
    `UPDATE messages 
     SET read_at = CURRENT_TIMESTAMP 
     WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
    [otherUserId, currentUserId]
  );

  res.json({
    otherUser: otherUser.rows[0],
    messages: messages.rows.reverse() // Return in chronological order
  });
}));

/**
 * @route POST /api/messaging/send
 * @desc Send a new message
 * @access Private
 */
router.post('/send', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = messageSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const senderId = req.user.id;
  const {
    recipient_id, message_text, voice_message_url, attachments,
    message_type, reply_to_id
  } = value;

  // Verify recipient exists and connection is allowed
  const recipient = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.role
     FROM users u
     LEFT JOIN family_connections fc ON 
       (fc.senior_id = u.id AND fc.caregiver_id = $1) OR 
       (fc.caregiver_id = u.id AND fc.senior_id = $1)
     WHERE u.id = $2 AND u.is_active = true
     AND (fc.status = 'active' OR u.role = 'admin')`,
    [senderId, recipient_id]
  );

  if (recipient.rows.length === 0) {
    return res.status(403).json({ error: 'Not authorized to message this user' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate conversation ID (consistent for both directions)
    const conversationId = [senderId, recipient_id].sort().join('-');

    // Encrypt message if contains sensitive data
    let encryptedText = message_text;
    let encryptionKey = null;
    
    if (message_text && process.env.ENABLE_MESSAGE_ENCRYPTION === 'true') {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', key);
      encryptedText = cipher.update(message_text, 'utf8', 'hex') + cipher.final('hex');
      encryptionKey = key.toString('hex');
    }

    // Insert message
    const messageResult = await client.query(
      `INSERT INTO messages 
       (conversation_id, sender_id, recipient_id, message_text, voice_message_url,
        attachments, message_type, is_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, conversation_id, sender_id, recipient_id, message_text,
                 voice_message_url, attachments, message_type, created_at`,
      [
        conversationId, senderId, recipient_id, encryptedText,
        voice_message_url, JSON.stringify(attachments || []), message_type,
        !!encryptionKey
      ]
    );

    await client.query('COMMIT');

    const message = messageResult.rows[0];

    // Send real-time notification via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${recipient_id}`).emit('new_message', {
        id: message.id,
        senderId: senderId,
        senderName: `${req.user.first_name} ${req.user.last_name}`,
        messageText: message_text, // Send unencrypted for real-time
        messageType: message_type,
        createdAt: message.created_at
      });
    }

    // Send push notification for emergency messages
    if (message_type === 'emergency') {
      try {
        await messagingHelpers.sendToDevice(
          'recipient_device_token', // This would come from user preferences
          {
            title: '🚨 Emergency Message',
            body: `${req.user.first_name} ${req.user.last_name} sent an emergency message`
          },
          {
            type: 'emergency_message',
            senderId: senderId,
            messageId: message.id
          }
        );
      } catch (notificationError) {
        logger.error('Failed to send push notification:', notificationError);
      }
    }

    logger.info(`Message sent from ${senderId} to ${recipient_id}`);

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: {
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        messageText: message_text, // Return unencrypted
        voiceMessageUrl: message.voice_message_url,
        attachments: JSON.parse(message.attachments),
        messageType: message.message_type,
        createdAt: message.created_at
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
 * @route DELETE /api/messaging/:messageId
 * @desc Delete a message
 * @access Private
 */
router.delete('/:messageId', authenticate, asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    `UPDATE messages 
     SET deleted_by_sender = CASE WHEN sender_id = $2 THEN true ELSE deleted_by_sender END,
         deleted_by_recipient = CASE WHEN recipient_id = $2 THEN true ELSE deleted_by_recipient END
     WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)
     RETURNING id, deleted_by_sender, deleted_by_recipient`,
    [messageId, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message not found' });
  }

  logger.info(`Message ${messageId} deleted by user ${userId}`);

  res.json({ message: 'Message deleted successfully' });
}));

/**
 * @route POST /api/messaging/:messageId/read
 * @desc Mark message as read
 * @access Private
 */
router.post('/:messageId/read', authenticate, asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    `UPDATE messages 
     SET read_at = CURRENT_TIMESTAMP 
     WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL
     RETURNING id`,
    [messageId, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message not found or already read' });
  }

  res.json({ message: 'Message marked as read' });
}));

/**
 * @route GET /api/messaging/unread-count
 * @desc Get unread message count for authenticated user
 * @access Private
 */
router.get('/unread-count', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await pool.query(
    'SELECT COUNT(*) as unread_count FROM messages WHERE recipient_id = $1 AND read_at IS NULL',
    [userId]
  );

  res.json({
    unreadCount: parseInt(result.rows[0].unread_count)
  });
}));

/**
 * @route GET /api/messaging/search
 * @desc Search messages
 * @access Private
 */
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { query, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  const result = await pool.query(
    `SELECT 
      m.id, m.sender_id, m.recipient_id, m.message_text, m.message_type, 
      m.created_at,
      sender.first_name as sender_first_name,
      sender.last_name as sender_last_name,
      recipient.first_name as recipient_first_name,
      recipient.last_name as recipient_last_name
    FROM messages m
    LEFT JOIN users sender ON m.sender_id = sender.id
    LEFT JOIN users recipient ON m.recipient_id = recipient.id
    WHERE (m.sender_id = $1 OR m.recipient_id = $1)
    AND m.message_text ILIKE $2
    AND m.deleted_by_sender = false 
    AND m.deleted_by_recipient = false
    ORDER BY m.created_at DESC
    LIMIT $3 OFFSET $4`,
    [userId, `%${query}%`, limit, offset]
  );

  res.json({
    results: result.rows,
    query,
    page: parseInt(page),
    limit: parseInt(limit)
  });
}));

/**
 * @route POST /api/messaging/emergency
 * @desc Send emergency message to all caregivers
 * @access Private (Seniors only)
 */
router.post('/emergency', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { message, location } = req.body;

  // Ensure only seniors can send emergency messages
  if (req.user.role !== 'senior') {
    return res.status(403).json({ error: 'Only seniors can send emergency messages' });
  }

  // Get all active caregivers for this senior
  const caregivers = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email
     FROM users u
     JOIN family_connections fc ON u.id = fc.caregiver_id
     WHERE fc.senior_id = $1 AND fc.status = 'active' AND u.is_active = true`,
    [userId]
  );

  if (caregivers.rows.length === 0) {
    return res.status(400).json({ error: 'No active caregivers found' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const emergencyMessage = message || 'Emergency assistance needed!';
    const messages = [];

    // Send emergency message to each caregiver
    for (const caregiver of caregivers.rows) {
      const conversationId = [userId, caregiver.id].sort().join('-');
      
      const messageResult = await client.query(
        `INSERT INTO messages 
         (conversation_id, sender_id, recipient_id, message_text, message_type)
         VALUES ($1, $2, $3, $4, 'emergency')
         RETURNING id, created_at`,
        [conversationId, userId, caregiver.id, emergencyMessage]
      );

      messages.push({
        messageId: messageResult.rows[0].id,
        caregiverId: caregiver.id,
        caregiverName: `${caregiver.first_name} ${caregiver.last_name}`
      });
    }

    // Log emergency alert
    await client.query(
      `INSERT INTO emergency_alerts 
       (user_id, alert_type, severity, message, location_data)
       VALUES ($1, 'manual', 'high', $2, $3)`,
      [userId, emergencyMessage, JSON.stringify(location || {})]
    );

    await client.query('COMMIT');

    // Send push notifications to all caregivers
    const caregiverTokens = []; // This would come from user device tokens
    if (caregiverTokens.length > 0) {
      try {
        await messagingHelpers.sendToMultipleDevices(
          caregiverTokens,
          {
            title: '🚨 Emergency Alert',
            body: `${req.user.first_name} ${req.user.last_name} needs immediate assistance`
          },
          {
            type: 'emergency_alert',
            seniorId: userId,
            message: emergencyMessage,
            location: JSON.stringify(location || {})
          }
        );
      } catch (notificationError) {
        logger.error('Failed to send emergency push notifications:', notificationError);
      }
    }

    logger.info(`Emergency message sent by user ${userId} to ${caregivers.rows.length} caregivers`);

    res.json({
      message: 'Emergency messages sent successfully',
      sentTo: messages
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

module.exports = router;