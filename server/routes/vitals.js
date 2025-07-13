const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { messagingHelpers, emergencyNotifications } = require('../config/firebase');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const vitalReadingSchema = Joi.object({
  reading_type: Joi.string().valid(
    'blood_pressure', 'heart_rate', 'blood_glucose', 'weight', 
    'oxygen_saturation', 'temperature', 'respiratory_rate'
  ).required(),
  value: Joi.object().required(), // Flexible structure for different reading types
  unit: Joi.string().min(1).max(20).required(),
  device_id: Joi.string().max(100).optional(),
  device_name: Joi.string().max(100).optional(),
  reading_time: Joi.date().default(() => new Date()),
  notes: Joi.string().max(500).allow('').optional()
});

// Define normal ranges for different vital signs
const VITAL_RANGES = {
  blood_pressure: {
    systolic: { min: 90, max: 140, unit: 'mmHg' },
    diastolic: { min: 60, max: 90, unit: 'mmHg' }
  },
  heart_rate: { min: 60, max: 100, unit: 'bpm' },
  blood_glucose: { min: 70, max: 140, unit: 'mg/dL' },
  oxygen_saturation: { min: 95, max: 100, unit: '%' },
  temperature: { min: 36.1, max: 37.2, unit: '°C' },
  respiratory_rate: { min: 12, max: 20, unit: 'breaths/min' }
};

/**
 * @route POST /api/vitals
 * @desc Record new vital reading
 * @access Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = vitalReadingSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const userId = req.user.id;
  const {
    reading_type, value: readingValue, unit, device_id,
    device_name, reading_time, notes
  } = value;

  // Check if reading is abnormal
  const isAbnormal = checkIfAbnormal(reading_type, readingValue);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert vital reading
    const result = await client.query(
      `INSERT INTO vitals_readings 
       (user_id, reading_type, value, unit, device_id, device_name, 
        reading_time, is_abnormal, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId, reading_type, JSON.stringify(readingValue), unit,
        device_id, device_name, reading_time, isAbnormal, notes
      ]
    );

    const vitalReading = result.rows[0];

    // If abnormal, create alert and notify caregivers
    if (isAbnormal) {
      await client.query(
        `INSERT INTO emergency_alerts 
         (user_id, alert_type, severity, message, vitals_data)
         VALUES ($1, 'vitals_abnormal', $2, $3, $4)`,
        [
          userId,
          getVitalSeverity(reading_type, readingValue),
          `Abnormal ${reading_type.replace('_', ' ')} reading: ${formatVitalValue(reading_type, readingValue)} ${unit}`,
          JSON.stringify(vitalReading)
        ]
      );

      // Get caregivers for notification
      const caregivers = await client.query(
        `SELECT u.id, u.first_name, u.last_name, u.email
         FROM users u
         JOIN family_connections fc ON u.id = fc.caregiver_id
         WHERE fc.senior_id = $1 AND fc.status = 'active'`,
        [userId]
      );

      // Send notifications to caregivers
      if (caregivers.rows.length > 0) {
        try {
          await emergencyNotifications.sendWellnessAnomalyAlert(
            [], // Device tokens would go here
            req.user,
            {
              type: 'abnormal_vitals',
              description: `Abnormal ${reading_type.replace('_', ' ')} reading detected`,
              reading: vitalReading
            }
          );
        } catch (notificationError) {
          logger.error('Failed to send vitals alert notification:', notificationError);
        }
      }
    }

    await client.query('COMMIT');

    logger.info(`Vital reading recorded: ${reading_type} for user ${userId}, abnormal: ${isAbnormal}`);

    res.status(201).json({
      message: 'Vital reading recorded successfully',
      reading: {
        id: vitalReading.id,
        readingType: vitalReading.reading_type,
        value: JSON.parse(vitalReading.value),
        unit: vitalReading.unit,
        deviceId: vitalReading.device_id,
        deviceName: vitalReading.device_name,
        readingTime: vitalReading.reading_time,
        isAbnormal: vitalReading.is_abnormal,
        notes: vitalReading.notes,
        createdAt: vitalReading.created_at
      },
      alertCreated: isAbnormal
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * @route GET /api/vitals
 * @desc Get vital readings for authenticated user
 * @access Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { 
    reading_type, 
    start_date, 
    end_date, 
    page = 1, 
    limit = 50,
    abnormal_only = 'false'
  } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE user_id = $1';
  let params = [userId];
  let paramCount = 1;

  if (reading_type) {
    paramCount++;
    whereClause += ` AND reading_type = $${paramCount}`;
    params.push(reading_type);
  }

  if (start_date) {
    paramCount++;
    whereClause += ` AND reading_time >= $${paramCount}`;
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    whereClause += ` AND reading_time <= $${paramCount}`;
    params.push(end_date);
  }

  if (abnormal_only === 'true') {
    whereClause += ' AND is_abnormal = true';
  }

  const result = await pool.query(
    `SELECT 
      id, user_id, reading_type, value, unit, device_id, device_name,
      reading_time, is_abnormal, notes, created_at
     FROM vitals_readings 
     ${whereClause}
     ORDER BY reading_time DESC
     LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
    [...params, limit, offset]
  );

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM vitals_readings ${whereClause}`,
    params
  );

  res.json({
    readings: result.rows.map(row => ({
      id: row.id,
      readingType: row.reading_type,
      value: JSON.parse(row.value),
      unit: row.unit,
      deviceId: row.device_id,
      deviceName: row.device_name,
      readingTime: row.reading_time,
      isAbnormal: row.is_abnormal,
      notes: row.notes,
      createdAt: row.created_at
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(countResult.rows[0].total),
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    }
  });
}));

/**
 * @route GET /api/vitals/latest
 * @desc Get latest readings for each vital type
 * @access Private
 */
router.get('/latest', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await pool.query(
    `SELECT DISTINCT ON (reading_type)
      id, reading_type, value, unit, device_name, reading_time, is_abnormal, notes
     FROM vitals_readings
     WHERE user_id = $1
     ORDER BY reading_type, reading_time DESC`,
    [userId]
  );

  const latestReadings = {};
  result.rows.forEach(row => {
    latestReadings[row.reading_type] = {
      id: row.id,
      value: JSON.parse(row.value),
      unit: row.unit,
      deviceName: row.device_name,
      readingTime: row.reading_time,
      isAbnormal: row.is_abnormal,
      notes: row.notes
    };
  });

  res.json({
    latestReadings
  });
}));

/**
 * @route GET /api/vitals/trends/:reading_type
 * @desc Get trend data for specific vital type
 * @access Private
 */
router.get('/trends/:reading_type', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { reading_type } = req.params;
  const { days = 30 } = req.query;

  const result = await pool.query(
    `SELECT 
      value, unit, reading_time, is_abnormal
     FROM vitals_readings
     WHERE user_id = $1 
     AND reading_type = $2
     AND reading_time >= CURRENT_DATE - INTERVAL '${days} days'
     ORDER BY reading_time ASC`,
    [userId, reading_type]
  );

  const trendData = result.rows.map(row => ({
    value: JSON.parse(row.value),
    unit: row.unit,
    timestamp: row.reading_time,
    isAbnormal: row.is_abnormal
  }));

  // Calculate statistics
  const stats = calculateVitalStats(reading_type, trendData);

  res.json({
    readingType: reading_type,
    timeRange: `${days} days`,
    trendData,
    statistics: stats,
    normalRange: VITAL_RANGES[reading_type] || null
  });
}));

/**
 * @route GET /api/vitals/summary
 * @desc Get vitals summary with statistics
 * @access Private
 */
router.get('/summary', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { days = 30 } = req.query;

  const result = await pool.query(
    `SELECT 
      reading_type,
      COUNT(*) as total_readings,
      COUNT(CASE WHEN is_abnormal = true THEN 1 END) as abnormal_readings,
      MAX(reading_time) as last_reading_time
     FROM vitals_readings
     WHERE user_id = $1 
     AND reading_time >= CURRENT_DATE - INTERVAL '${days} days'
     GROUP BY reading_type
     ORDER BY reading_type`,
    [userId]
  );

  const summary = {};
  result.rows.forEach(row => {
    summary[row.reading_type] = {
      totalReadings: parseInt(row.total_readings),
      abnormalReadings: parseInt(row.abnormal_readings),
      abnormalPercentage: row.total_readings > 0 
        ? Math.round((row.abnormal_readings / row.total_readings) * 100)
        : 0,
      lastReadingTime: row.last_reading_time
    };
  });

  res.json({
    timeRange: `${days} days`,
    summary
  });
}));

/**
 * @route DELETE /api/vitals/:id
 * @desc Delete a vital reading
 * @access Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'DELETE FROM vitals_readings WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Vital reading not found' });
  }

  logger.info(`Vital reading ${id} deleted by user ${userId}`);

  res.json({ message: 'Vital reading deleted successfully' });
}));

/**
 * @route POST /api/vitals/bulk-import
 * @desc Import multiple vital readings (for IoT device integration)
 * @access Private
 */
router.post('/bulk-import', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { readings, device_id, device_name } = req.body;

  const bulkSchema = Joi.object({
    readings: Joi.array().items(vitalReadingSchema).min(1).max(100).required(),
    device_id: Joi.string().max(100).required(),
    device_name: Joi.string().max(100).required()
  });

  const { error, value } = bulkSchema.validate({ readings, device_id, device_name });
  if (error) {
    throw new ValidationError('Validation failed', error.details);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertedReadings = [];
    const abnormalReadings = [];

    for (const reading of value.readings) {
      const isAbnormal = checkIfAbnormal(reading.reading_type, reading.value);
      
      const result = await client.query(
        `INSERT INTO vitals_readings 
         (user_id, reading_type, value, unit, device_id, device_name, 
          reading_time, is_abnormal, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          userId, reading.reading_type, JSON.stringify(reading.value), 
          reading.unit, device_id, device_name, reading.reading_time || new Date(),
          isAbnormal, reading.notes || null
        ]
      );

      const insertedReading = result.rows[0];
      insertedReadings.push(insertedReading);

      if (isAbnormal) {
        abnormalReadings.push(insertedReading);
      }
    }

    // Create alerts for abnormal readings
    if (abnormalReadings.length > 0) {
      const alertMessage = abnormalReadings.length === 1
        ? `Abnormal ${abnormalReadings[0].reading_type.replace('_', ' ')} reading detected`
        : `${abnormalReadings.length} abnormal vital readings detected`;

      await client.query(
        `INSERT INTO emergency_alerts 
         (user_id, alert_type, severity, message, vitals_data)
         VALUES ($1, 'vitals_abnormal', 'medium', $2, $3)`,
        [userId, alertMessage, JSON.stringify(abnormalReadings)]
      );
    }

    await client.query('COMMIT');

    logger.info(`Bulk imported ${insertedReadings.length} vital readings for user ${userId}, ${abnormalReadings.length} abnormal`);

    res.status(201).json({
      message: 'Vital readings imported successfully',
      imported: insertedReadings.length,
      abnormalDetected: abnormalReadings.length,
      deviceId: device_id,
      deviceName: device_name
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * Helper function to check if a vital reading is abnormal
 */
function checkIfAbnormal(readingType, value) {
  const range = VITAL_RANGES[readingType];
  if (!range) return false;

  switch (readingType) {
    case 'blood_pressure':
      const systolic = value.systolic || 0;
      const diastolic = value.diastolic || 0;
      return systolic < range.systolic.min || systolic > range.systolic.max ||
             diastolic < range.diastolic.min || diastolic > range.diastolic.max;
    
    default:
      const numValue = typeof value === 'object' ? value.value : value;
      return numValue < range.min || numValue > range.max;
  }
}

/**
 * Helper function to get severity based on how far outside normal range
 */
function getVitalSeverity(readingType, value) {
  const range = VITAL_RANGES[readingType];
  if (!range) return 'medium';

  // Simple severity calculation - can be enhanced
  switch (readingType) {
    case 'blood_pressure':
      const systolic = value.systolic || 0;
      if (systolic > 180 || systolic < 70) return 'critical';
      if (systolic > 160 || systolic < 80) return 'high';
      return 'medium';
    
    case 'heart_rate':
      const hr = typeof value === 'object' ? value.value : value;
      if (hr > 120 || hr < 50) return 'high';
      return 'medium';
    
    default:
      return 'medium';
  }
}

/**
 * Helper function to format vital values for display
 */
function formatVitalValue(readingType, value) {
  switch (readingType) {
    case 'blood_pressure':
      return `${value.systolic}/${value.diastolic}`;
    default:
      return typeof value === 'object' ? value.value : value;
  }
}

/**
 * Calculate statistics for vital trends
 */
function calculateVitalStats(readingType, trendData) {
  if (trendData.length === 0) return null;

  let values;
  if (readingType === 'blood_pressure') {
    const systolicValues = trendData.map(d => d.value.systolic).filter(v => v);
    const diastolicValues = trendData.map(d => d.value.diastolic).filter(v => v);
    
    return {
      systolic: calculateNumericStats(systolicValues),
      diastolic: calculateNumericStats(diastolicValues),
      totalReadings: trendData.length,
      abnormalCount: trendData.filter(d => d.isAbnormal).length
    };
  } else {
    values = trendData.map(d => typeof d.value === 'object' ? d.value.value : d.value).filter(v => v);
    return {
      ...calculateNumericStats(values),
      totalReadings: trendData.length,
      abnormalCount: trendData.filter(d => d.isAbnormal).length
    };
  }
}

/**
 * Calculate numeric statistics
 */
function calculateNumericStats(values) {
  if (values.length === 0) return { min: 0, max: 0, average: 0 };
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  return {
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    average: parseFloat(average.toFixed(2))
  };
}

module.exports = router;