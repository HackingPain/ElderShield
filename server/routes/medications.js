const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

// Validation schemas
const medicationSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  dosage: Joi.string().min(1).max(100).required(),
  frequency: Joi.string().valid('daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'weekly', 'as_needed').required(),
  times: Joi.array().items(Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)).min(1).required(),
  instructions: Joi.string().max(1000).allow('').optional(),
  prescriber_name: Joi.string().max(100).allow('').optional(),
  prescription_number: Joi.string().max(50).allow('').optional(),
  refills_remaining: Joi.number().integer().min(0).max(12).default(0),
  side_effects: Joi.string().max(500).allow('').optional(),
  start_date: Joi.date().required(),
  end_date: Joi.date().optional(),
  photo_url: Joi.string().uri().optional()
});

const medicationUpdateSchema = medicationSchema.fork(['name', 'dosage', 'frequency', 'times', 'start_date'], schema => schema.optional());

const reminderSchema = Joi.object({
  medication_id: Joi.string().uuid().required(),
  scheduled_time: Joi.date().required(),
  confirmation_method: Joi.string().valid('tap', 'photo', 'voice').default('tap'),
  photo_url: Joi.string().uri().optional(),
  notes: Joi.string().max(500).allow('').optional()
});

/**
 * @route GET /api/medications
 * @desc Get all medications for authenticated user
 * @access Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { active_only = 'true' } = req.query;

  let query = `
    SELECT 
      id, user_id, name, dosage, frequency, times, instructions,
      prescriber_name, prescription_number, refills_remaining,
      side_effects, photo_url, is_active, start_date, end_date,
      created_at, updated_at
    FROM medications 
    WHERE user_id = $1
  `;

  const params = [userId];

  if (active_only === 'true') {
    query += ' AND is_active = true';
  }

  query += ' ORDER BY name ASC';

  const result = await pool.query(query, params);

  res.json({
    medications: result.rows
  });
}));

/**
 * @route GET /api/medications/:id
 * @desc Get specific medication by ID
 * @access Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    `SELECT 
      id, user_id, name, dosage, frequency, times, instructions,
      prescriber_name, prescription_number, refills_remaining,
      side_effects, photo_url, is_active, start_date, end_date,
      created_at, updated_at
    FROM medications 
    WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Medication not found' });
  }

  res.json({
    medication: result.rows[0]
  });
}));

/**
 * @route POST /api/medications
 * @desc Create new medication
 * @access Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = medicationSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const userId = req.user.id;
  const {
    name, dosage, frequency, times, instructions, prescriber_name,
    prescription_number, refills_remaining, side_effects, start_date,
    end_date, photo_url
  } = value;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO medications 
       (user_id, name, dosage, frequency, times, instructions, prescriber_name,
        prescription_number, refills_remaining, side_effects, start_date, end_date, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userId, name, dosage, frequency, JSON.stringify(times), instructions,
        prescriber_name, prescription_number, refills_remaining, side_effects,
        start_date, end_date, photo_url
      ]
    );

    const medication = result.rows[0];

    // Create initial reminders for the medication
    await createMedicationReminders(client, medication);

    await client.query('COMMIT');

    logger.info(`Medication created: ${name} for user ${userId}`);

    res.status(201).json({
      message: 'Medication created successfully',
      medication: medication
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * @route PUT /api/medications/:id
 * @desc Update existing medication
 * @access Private
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error, value } = medicationUpdateSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const userId = req.user.id;

  // Check if medication exists and belongs to user
  const existingMed = await pool.query(
    'SELECT id FROM medications WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  if (existingMed.rows.length === 0) {
    return res.status(404).json({ error: 'Medication not found' });
  }

  const updateFields = [];
  const updateValues = [];
  let paramCount = 1;

  Object.keys(value).forEach(key => {
    if (value[key] !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      updateValues.push(
        key === 'times' ? JSON.stringify(value[key]) : value[key]
      );
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(id, userId);

  const query = `
    UPDATE medications 
    SET ${updateFields.join(', ')} 
    WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
    RETURNING *
  `;

  const result = await pool.query(query, updateValues);

  logger.info(`Medication updated: ${id} by user ${userId}`);

  res.json({
    message: 'Medication updated successfully',
    medication: result.rows[0]
  });
}));

/**
 * @route DELETE /api/medications/:id
 * @desc Delete/deactivate medication
 * @access Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'UPDATE medications SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Medication not found' });
  }

  logger.info(`Medication deactivated: ${id} by user ${userId}`);

  res.json({ message: 'Medication deactivated successfully' });
}));

/**
 * @route GET /api/medications/reminders/today
 * @desc Get today's medication reminders
 * @access Private
 */
router.get('/reminders/today', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const result = await pool.query(
    `SELECT 
      mr.id, mr.medication_id, mr.scheduled_time, mr.taken_at, mr.skipped,
      mr.confirmation_method, mr.photo_url, mr.notes,
      m.name, m.dosage, m.instructions, m.photo_url as medication_photo
    FROM medication_reminders mr
    JOIN medications m ON mr.medication_id = m.id
    WHERE mr.user_id = $1 
    AND DATE(mr.scheduled_time) = $2
    AND m.is_active = true
    ORDER BY mr.scheduled_time ASC`,
    [userId, today]
  );

  res.json({
    reminders: result.rows
  });
}));

/**
 * @route GET /api/medications/reminders/upcoming
 * @desc Get upcoming medication reminders
 * @access Private
 */
router.get('/reminders/upcoming', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { hours = 24 } = req.query;

  const result = await pool.query(
    `SELECT 
      mr.id, mr.medication_id, mr.scheduled_time, mr.taken_at, mr.skipped,
      mr.confirmation_method, mr.photo_url, mr.notes,
      m.name, m.dosage, m.instructions, m.photo_url as medication_photo
    FROM medication_reminders mr
    JOIN medications m ON mr.medication_id = m.id
    WHERE mr.user_id = $1 
    AND mr.scheduled_time BETWEEN NOW() AND NOW() + INTERVAL '${hours} hours'
    AND mr.taken_at IS NULL
    AND mr.skipped = false
    AND m.is_active = true
    ORDER BY mr.scheduled_time ASC`,
    [userId]
  );

  res.json({
    reminders: result.rows
  });
}));

/**
 * @route POST /api/medications/reminders/:id/take
 * @desc Mark medication reminder as taken
 * @access Private
 */
router.post('/reminders/:id/take', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { confirmation_method = 'tap', photo_url, notes } = req.body;

  const result = await pool.query(
    `UPDATE medication_reminders 
     SET taken_at = CURRENT_TIMESTAMP, confirmation_method = $1, photo_url = $2, notes = $3
     WHERE id = $4 AND user_id = $5 AND taken_at IS NULL
     RETURNING *`,
    [confirmation_method, photo_url, notes, id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Reminder not found or already taken' });
  }

  logger.info(`Medication reminder ${id} marked as taken by user ${userId}`);

  res.json({
    message: 'Medication marked as taken',
    reminder: result.rows[0]
  });
}));

/**
 * @route POST /api/medications/reminders/:id/skip
 * @desc Mark medication reminder as skipped
 * @access Private
 */
router.post('/reminders/:id/skip', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { notes } = req.body;

  const result = await pool.query(
    `UPDATE medication_reminders 
     SET skipped = true, notes = $1
     WHERE id = $2 AND user_id = $3 AND taken_at IS NULL
     RETURNING *`,
    [notes, id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Reminder not found or already taken' });
  }

  logger.info(`Medication reminder ${id} marked as skipped by user ${userId}`);

  res.json({
    message: 'Medication marked as skipped',
    reminder: result.rows[0]
  });
}));

/**
 * @route GET /api/medications/adherence
 * @desc Get medication adherence statistics
 * @access Private
 */
router.get('/adherence', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { days = 30 } = req.query;

  const result = await pool.query(
    `SELECT 
      COUNT(*) as total_reminders,
      COUNT(CASE WHEN taken_at IS NOT NULL THEN 1 END) as taken_count,
      COUNT(CASE WHEN skipped = true THEN 1 END) as skipped_count,
      COUNT(CASE WHEN taken_at IS NULL AND skipped = false AND scheduled_time < NOW() THEN 1 END) as missed_count
    FROM medication_reminders mr
    JOIN medications m ON mr.medication_id = m.id
    WHERE mr.user_id = $1 
    AND mr.scheduled_time >= NOW() - INTERVAL '${days} days'
    AND m.is_active = true`,
    [userId]
  );

  const stats = result.rows[0];
  const totalReminders = parseInt(stats.total_reminders);
  const takenCount = parseInt(stats.taken_count);
  const skippedCount = parseInt(stats.skipped_count);
  const missedCount = parseInt(stats.missed_count);

  const adherenceRate = totalReminders > 0 ? ((takenCount / totalReminders) * 100).toFixed(1) : 0;

  res.json({
    adherenceRate: parseFloat(adherenceRate),
    statistics: {
      totalReminders,
      takenCount,
      skippedCount,
      missedCount
    }
  });
}));

/**
 * Helper function to create medication reminders
 */
async function createMedicationReminders(client, medication) {
  const { id: medicationId, user_id: userId, times, start_date, end_date } = medication;
  const timesArray = JSON.parse(times);
  
  // Create reminders for the next 30 days
  const startDate = new Date(start_date);
  const endDate = end_date ? new Date(end_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    for (const time of timesArray) {
      const [hours, minutes] = time.split(':');
      const reminderTime = new Date(date);
      reminderTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      // Only create reminders for future times
      if (reminderTime > new Date()) {
        await client.query(
          `INSERT INTO medication_reminders (medication_id, user_id, scheduled_time)
           VALUES ($1, $2, $3)`,
          [medicationId, userId, reminderTime]
        );
      }
    }
  }
}

module.exports = router;