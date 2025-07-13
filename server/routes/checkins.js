const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { messagingHelpers } = require('../config/firebase');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const checkInSchema = Joi.object({
  mood_rating: Joi.number().integer().min(1).max(5).required(),
  energy_level: Joi.number().integer().min(1).max(5).required(),
  pain_level: Joi.number().integer().min(1).max(5).required(),
  sleep_quality: Joi.number().integer().min(1).max(5).required(),
  appetite_rating: Joi.number().integer().min(1).max(5).required(),
  hydration_glasses: Joi.number().integer().min(0).max(20).default(0),
  medications_taken: Joi.boolean().default(false),
  exercise_minutes: Joi.number().integer().min(0).max(480).default(0),
  social_interaction: Joi.boolean().default(false),
  notes: Joi.string().max(1000).allow('').optional(),
  voice_note_url: Joi.string().uri().optional()
});

/**
 * @route GET /api/checkins
 * @desc Get daily check-ins for authenticated user
 * @access Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, start_date, end_date } = req.query;
  const offset = (page - 1) * limit;
  const userId = req.user.id;

  let whereClause = 'WHERE user_id = $1';
  let params = [userId];
  let paramCount = 1;

  // Add date filters if provided
  if (start_date) {
    paramCount++;
    whereClause += ` AND date >= $${paramCount}`;
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    whereClause += ` AND date <= $${paramCount}`;
    params.push(end_date);
  }

  // Add pagination
  paramCount++;
  whereClause += ` ORDER BY date DESC LIMIT $${paramCount}`;
  params.push(limit);

  paramCount++;
  whereClause += ` OFFSET $${paramCount}`;
  params.push(offset);

  const query = `
    SELECT 
      id, user_id, date, mood_rating, energy_level, pain_level, 
      sleep_quality, appetite_rating, hydration_glasses, medications_taken,
      exercise_minutes, social_interaction, notes, voice_note_url,
      completed_at, created_at, updated_at
    FROM daily_checkins 
    ${whereClause}
  `;

  const checkInsResult = await pool.query(query, params);

  // Get total count for pagination
  const countQuery = `
    SELECT COUNT(*) as total 
    FROM daily_checkins 
    WHERE user_id = $1 
    ${start_date ? 'AND date >= $2' : ''}
    ${end_date ? `AND date >= $${start_date ? 3 : 2}` : ''}
  `;

  const countParams = [userId];
  if (start_date) countParams.push(start_date);
  if (end_date) countParams.push(end_date);

  const countResult = await pool.query(countQuery, countParams);
  const totalCount = parseInt(countResult.rows[0].total);

  res.json({
    checkIns: checkInsResult.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  });
}));

/**
 * @route GET /api/checkins/today
 * @desc Get today's check-in for authenticated user
 * @access Private
 */
router.get('/today', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const result = await pool.query(
    `SELECT 
      id, user_id, date, mood_rating, energy_level, pain_level, 
      sleep_quality, appetite_rating, hydration_glasses, medications_taken,
      exercise_minutes, social_interaction, notes, voice_note_url,
      completed_at, created_at, updated_at
    FROM daily_checkins 
    WHERE user_id = $1 AND date = $2`,
    [userId, today]
  );

  if (result.rows.length === 0) {
    return res.json({ checkIn: null, hasCheckedIn: false });
  }

  res.json({
    checkIn: result.rows[0],
    hasCheckedIn: true
  });
}));

/**
 * @route POST /api/checkins
 * @desc Create or update today's check-in
 * @access Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = checkInSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const {
    mood_rating, energy_level, pain_level, sleep_quality, appetite_rating,
    hydration_glasses, medications_taken, exercise_minutes, social_interaction,
    notes, voice_note_url
  } = value;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if check-in already exists for today
    const existingCheckIn = await client.query(
      'SELECT id FROM daily_checkins WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    let checkInResult;
    if (existingCheckIn.rows.length > 0) {
      // Update existing check-in
      checkInResult = await client.query(
        `UPDATE daily_checkins 
         SET mood_rating = $1, energy_level = $2, pain_level = $3, 
             sleep_quality = $4, appetite_rating = $5, hydration_glasses = $6,
             medications_taken = $7, exercise_minutes = $8, social_interaction = $9,
             notes = $10, voice_note_url = $11, completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $12 AND date = $13
         RETURNING *`,
        [
          mood_rating, energy_level, pain_level, sleep_quality, appetite_rating,
          hydration_glasses, medications_taken, exercise_minutes, social_interaction,
          notes, voice_note_url, userId, today
        ]
      );
    } else {
      // Create new check-in
      checkInResult = await client.query(
        `INSERT INTO daily_checkins 
         (user_id, date, mood_rating, energy_level, pain_level, sleep_quality,
          appetite_rating, hydration_glasses, medications_taken, exercise_minutes,
          social_interaction, notes, voice_note_url, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          userId, today, mood_rating, energy_level, pain_level, sleep_quality,
          appetite_rating, hydration_glasses, medications_taken, exercise_minutes,
          social_interaction, notes, voice_note_url
        ]
      );
    }

    await client.query('COMMIT');

    const checkIn = checkInResult.rows[0];

    // Notify caregivers if there are concerning metrics
    if (mood_rating <= 2 || energy_level <= 2 || pain_level >= 4) {
      // Get caregivers for notifications
      const caregiversResult = await client.query(
        `SELECT u.id, u.first_name, u.last_name, u.email 
         FROM users u 
         JOIN family_connections fc ON u.id = fc.caregiver_id 
         WHERE fc.senior_id = $1 AND fc.status = 'active'`,
        [userId]
      );

      // Send notifications to caregivers (implement notification logic)
      for (const caregiver of caregiversResult.rows) {
        // This would integrate with your notification system
        logger.info(`Sending wellness concern notification to caregiver ${caregiver.id}`);
      }
    }

    logger.info(`Daily check-in ${existingCheckIn.rows.length > 0 ? 'updated' : 'created'} for user ${userId}`);

    res.json({
      message: 'Check-in saved successfully',
      checkIn: checkIn,
      isUpdate: existingCheckIn.rows.length > 0
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * @route GET /api/checkins/streak
 * @desc Get user's check-in streak information
 * @access Private
 */
router.get('/streak', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get last 30 days of check-ins
  const result = await pool.query(
    `SELECT date, completed_at
     FROM daily_checkins 
     WHERE user_id = $1 
     AND date >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY date DESC`,
    [userId]
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date().toISOString().split('T')[0];
  const checkInDates = result.rows.map(row => row.date);

  // Calculate current streak
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    if (checkInDates.includes(dateStr)) {
      if (i === 0 || currentStreak > 0) {
        currentStreak++;
      }
      tempStreak++;
    } else {
      if (i === 0) {
        currentStreak = 0;
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      tempStreak = 0;
    }
  }

  if (tempStreak > longestStreak) {
    longestStreak = tempStreak;
  }

  res.json({
    currentStreak,
    longestStreak,
    totalCheckIns: result.rows.length,
    lastCheckIn: result.rows.length > 0 ? result.rows[0].date : null
  });
}));

/**
 * @route GET /api/checkins/analytics
 * @desc Get analytics data for check-ins
 * @access Private
 */
router.get('/analytics', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { days = 30 } = req.query;

  const result = await pool.query(
    `SELECT 
      date, mood_rating, energy_level, pain_level, sleep_quality, 
      appetite_rating, hydration_glasses, exercise_minutes,
      medications_taken, social_interaction
     FROM daily_checkins 
     WHERE user_id = $1 
     AND date >= CURRENT_DATE - INTERVAL '${days} days'
     ORDER BY date DESC`,
    [userId]
  );

  const analytics = {
    totalCheckIns: result.rows.length,
    averages: {
      mood: 0,
      energy: 0,
      pain: 0,
      sleep: 0,
      appetite: 0,
      hydration: 0,
      exercise: 0
    },
    trends: {
      mood: [],
      energy: [],
      pain: [],
      sleep: [],
      appetite: [],
      hydration: [],
      exercise: []
    },
    medicationCompliance: 0,
    socialInteractionDays: 0
  };

  if (result.rows.length > 0) {
    const totals = result.rows.reduce((acc, row) => {
      acc.mood += row.mood_rating || 0;
      acc.energy += row.energy_level || 0;
      acc.pain += row.pain_level || 0;
      acc.sleep += row.sleep_quality || 0;
      acc.appetite += row.appetite_rating || 0;
      acc.hydration += row.hydration_glasses || 0;
      acc.exercise += row.exercise_minutes || 0;
      acc.medicationsTaken += row.medications_taken ? 1 : 0;
      acc.socialInteraction += row.social_interaction ? 1 : 0;
      return acc;
    }, {
      mood: 0, energy: 0, pain: 0, sleep: 0, appetite: 0,
      hydration: 0, exercise: 0, medicationsTaken: 0, socialInteraction: 0
    });

    const count = result.rows.length;
    analytics.averages = {
      mood: (totals.mood / count).toFixed(1),
      energy: (totals.energy / count).toFixed(1),
      pain: (totals.pain / count).toFixed(1),
      sleep: (totals.sleep / count).toFixed(1),
      appetite: (totals.appetite / count).toFixed(1),
      hydration: (totals.hydration / count).toFixed(1),
      exercise: (totals.exercise / count).toFixed(0)
    };

    analytics.medicationCompliance = ((totals.medicationsTaken / count) * 100).toFixed(1);
    analytics.socialInteractionDays = totals.socialInteraction;

    // Create trend data
    result.rows.reverse().forEach(row => {
      analytics.trends.mood.push({ date: row.date, value: row.mood_rating });
      analytics.trends.energy.push({ date: row.date, value: row.energy_level });
      analytics.trends.pain.push({ date: row.date, value: row.pain_level });
      analytics.trends.sleep.push({ date: row.date, value: row.sleep_quality });
      analytics.trends.appetite.push({ date: row.date, value: row.appetite_rating });
      analytics.trends.hydration.push({ date: row.date, value: row.hydration_glasses });
      analytics.trends.exercise.push({ date: row.date, value: row.exercise_minutes });
    });
  }

  res.json(analytics);
}));

/**
 * @route DELETE /api/checkins/:id
 * @desc Delete a specific check-in
 * @access Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'DELETE FROM daily_checkins WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Check-in not found' });
  }

  logger.info(`Check-in ${id} deleted by user ${userId}`);

  res.json({ message: 'Check-in deleted successfully' });
}));

module.exports = router;