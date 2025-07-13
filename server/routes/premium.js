const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, ForbiddenError } = require('../middleware/errorHandler');
const { cacheHelpers } = require('../config/redis');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to check premium subscription
const requirePremium = (req, res, next) => {
  if (req.user.subscription_tier !== 'premium' && req.user.subscription_tier !== 'enterprise') {
    throw new ForbiddenError('Premium subscription required');
  }
  next();
};

/**
 * @route GET /api/premium/wellness-score
 * @desc Get AI-powered wellness score for user
 * @access Private (Premium only)
 */
router.get('/wellness-score', authenticate, requirePremium, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { days = 7 } = req.query;

  // Check cache first
  const cacheKey = `wellness_score:${userId}:${days}`;
  const cachedScore = await cacheHelpers.get(cacheKey);
  if (cachedScore) {
    return res.json(cachedScore);
  }

  const client = await pool.connect();
  try {
    // Get recent check-ins
    const checkIns = await client.query(
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

    // Get medication adherence
    const medicationStats = await client.query(
      `SELECT 
        COUNT(*) as total_reminders,
        COUNT(CASE WHEN taken_at IS NOT NULL THEN 1 END) as taken_count
       FROM medication_reminders mr
       JOIN medications m ON mr.medication_id = m.id
       WHERE mr.user_id = $1 
       AND mr.scheduled_time >= CURRENT_DATE - INTERVAL '${days} days'
       AND mr.scheduled_time < NOW()
       AND m.is_active = true`,
      [userId]
    );

    // Get vitals data
    const vitals = await client.query(
      `SELECT reading_type, value, is_abnormal, reading_time
       FROM vitals_readings
       WHERE user_id = $1 
       AND reading_time >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY reading_time DESC`,
      [userId]
    );

    // Calculate wellness score using AI algorithm (mock implementation)
    const wellnessScore = calculateWellnessScore(
      checkIns.rows,
      medicationStats.rows[0],
      vitals.rows
    );

    // Store score in database
    const today = new Date().toISOString().split('T')[0];
    await client.query(
      `INSERT INTO wellness_scores 
       (user_id, date, overall_score, mood_score, physical_score, social_score, 
        medication_compliance_score, trend_direction, ai_insights, recommendations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, date) 
       DO UPDATE SET 
         overall_score = EXCLUDED.overall_score,
         mood_score = EXCLUDED.mood_score,
         physical_score = EXCLUDED.physical_score,
         social_score = EXCLUDED.social_score,
         medication_compliance_score = EXCLUDED.medication_compliance_score,
         trend_direction = EXCLUDED.trend_direction,
         ai_insights = EXCLUDED.ai_insights,
         recommendations = EXCLUDED.recommendations`,
      [
        userId, today, wellnessScore.overall, wellnessScore.mood,
        wellnessScore.physical, wellnessScore.social, wellnessScore.medication,
        wellnessScore.trend, JSON.stringify(wellnessScore.insights),
        JSON.stringify(wellnessScore.recommendations)
      ]
    );

    // Cache for 1 hour
    await cacheHelpers.set(cacheKey, wellnessScore, 3600);

    logger.info(`Wellness score calculated for user ${userId}: ${wellnessScore.overall}`);

    res.json(wellnessScore);

  } finally {
    client.release();
  }
}));

/**
 * @route GET /api/premium/anomaly-detection
 * @desc Get AI-powered anomaly detection alerts
 * @access Private (Premium only)
 */
router.get('/anomaly-detection', authenticate, requirePremium, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, status = 'active' } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE user_id = $1';
  let params = [userId];

  if (status !== 'all') {
    params.push(status);
    whereClause += ` AND status = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT 
      id, user_id, anomaly_type, severity, description, data_context,
      ai_confidence, status, acknowledged_by, acknowledged_at, created_at
     FROM anomaly_alerts 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.json({
    anomalies: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit)
    }
  });
}));

/**
 * @route POST /api/premium/detect-anomalies
 * @desc Run anomaly detection analysis
 * @access Private (Premium only)
 */
router.post('/detect-anomalies', authenticate, requirePremium, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get user's baseline data (last 30 days)
    const baseline = await client.query(
      `SELECT 
        AVG(mood_rating) as avg_mood,
        AVG(energy_level) as avg_energy,
        AVG(sleep_quality) as avg_sleep,
        COUNT(*) as total_checkins
       FROM daily_checkins
       WHERE user_id = $1 
       AND date >= CURRENT_DATE - INTERVAL '30 days'
       AND date < CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    // Get recent data (last 7 days)
    const recent = await client.query(
      `SELECT 
        AVG(mood_rating) as avg_mood,
        AVG(energy_level) as avg_energy,
        AVG(sleep_quality) as avg_sleep,
        COUNT(*) as total_checkins,
        COUNT(CASE WHEN mood_rating <= 2 THEN 1 END) as low_mood_days,
        COUNT(CASE WHEN energy_level <= 2 THEN 1 END) as low_energy_days
       FROM daily_checkins
       WHERE user_id = $1 
       AND date >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    const anomalies = detectAnomalies(baseline.rows[0], recent.rows[0]);

    // Create anomaly alerts
    for (const anomaly of anomalies) {
      await client.query(
        `INSERT INTO anomaly_alerts 
         (user_id, anomaly_type, severity, description, data_context, ai_confidence)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId, anomaly.type, anomaly.severity, anomaly.description,
          JSON.stringify(anomaly.context), anomaly.confidence
        ]
      );
    }

    await client.query('COMMIT');

    logger.info(`Anomaly detection completed for user ${userId}, found ${anomalies.length} anomalies`);

    res.json({
      message: 'Anomaly detection completed',
      anomaliesDetected: anomalies.length,
      anomalies: anomalies
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * @route GET /api/premium/ai-insights
 * @desc Get AI-powered health insights and recommendations
 * @access Private (Premium only)
 */
router.get('/ai-insights', authenticate, requirePremium, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    // Get comprehensive user data for AI analysis
    const userData = await client.query(
      `SELECT 
        u.date_of_birth, u.preferences,
        EXTRACT(YEAR FROM AGE(u.date_of_birth)) as age
       FROM users u
       WHERE u.id = $1`,
      [userId]
    );

    // Get recent wellness patterns
    const patterns = await client.query(
      `SELECT 
        date, mood_rating, energy_level, pain_level, sleep_quality,
        exercise_minutes, social_interaction
       FROM daily_checkins
       WHERE user_id = $1 
       AND date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY date DESC`,
      [userId]
    );

    // Get medication adherence patterns
    const medicationPatterns = await client.query(
      `SELECT 
        DATE(scheduled_time) as date,
        COUNT(*) as total_scheduled,
        COUNT(taken_at) as taken,
        COUNT(CASE WHEN skipped = true THEN 1 END) as skipped
       FROM medication_reminders mr
       JOIN medications m ON mr.medication_id = m.id
       WHERE mr.user_id = $1 
       AND mr.scheduled_time >= CURRENT_DATE - INTERVAL '30 days'
       AND m.is_active = true
       GROUP BY DATE(scheduled_time)
       ORDER BY date DESC`,
      [userId]
    );

    // Generate AI insights (mock implementation)
    const insights = generateAIInsights(
      userData.rows[0],
      patterns.rows,
      medicationPatterns.rows
    );

    res.json(insights);

  } finally {
    client.release();
  }
}));

/**
 * @route GET /api/premium/predictive-analytics
 * @desc Get predictive health analytics
 * @access Private (Premium only)
 */
router.get('/predictive-analytics', authenticate, requirePremium, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    // Get historical data for prediction models
    const historicalData = await client.query(
      `SELECT 
        date, mood_rating, energy_level, pain_level, sleep_quality,
        appetite_rating, exercise_minutes
       FROM daily_checkins
       WHERE user_id = $1 
       AND date >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY date ASC`,
      [userId]
    );

    // Get vitals trends
    const vitalsData = await client.query(
      `SELECT 
        reading_type, value, reading_time, is_abnormal
       FROM vitals_readings
       WHERE user_id = $1 
       AND reading_time >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY reading_time ASC`,
      [userId]
    );

    // Generate predictive analytics (mock implementation)
    const predictions = generatePredictiveAnalytics(
      historicalData.rows,
      vitalsData.rows
    );

    res.json(predictions);

  } finally {
    client.release();
  }
}));

/**
 * Helper function to calculate wellness score
 */
function calculateWellnessScore(checkIns, medicationStats, vitals) {
  if (checkIns.length === 0) {
    return {
      overall: 0,
      mood: 0,
      physical: 0,
      social: 0,
      medication: 0,
      trend: 'stable',
      insights: [],
      recommendations: []
    };
  }

  // Calculate mood score (1-100)
  const avgMood = checkIns.reduce((sum, c) => sum + (c.mood_rating || 0), 0) / checkIns.length;
  const moodScore = Math.round((avgMood / 5) * 100);

  // Calculate physical score
  const avgEnergy = checkIns.reduce((sum, c) => sum + (c.energy_level || 0), 0) / checkIns.length;
  const avgPain = checkIns.reduce((sum, c) => sum + (c.pain_level || 0), 0) / checkIns.length;
  const avgSleep = checkIns.reduce((sum, c) => sum + (c.sleep_quality || 0), 0) / checkIns.length;
  const physicalScore = Math.round(((avgEnergy + avgSleep + (5 - avgPain)) / 15) * 100);

  // Calculate social score
  const socialDays = checkIns.filter(c => c.social_interaction).length;
  const socialScore = Math.round((socialDays / checkIns.length) * 100);

  // Calculate medication compliance score
  const totalReminders = parseInt(medicationStats.total_reminders) || 0;
  const takenCount = parseInt(medicationStats.taken_count) || 0;
  const medicationScore = totalReminders > 0 ? Math.round((takenCount / totalReminders) * 100) : 100;

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    (moodScore * 0.3) + (physicalScore * 0.35) + (socialScore * 0.15) + (medicationScore * 0.2)
  );

  // Determine trend
  const recentScores = checkIns.slice(0, 3).map(c => (c.mood_rating + c.energy_level + c.sleep_quality) / 3);
  const olderScores = checkIns.slice(-3).map(c => (c.mood_rating + c.energy_level + c.sleep_quality) / 3);
  
  const recentAvg = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;
  const olderAvg = olderScores.reduce((sum, s) => sum + s, 0) / olderScores.length;
  
  let trend = 'stable';
  if (recentAvg > olderAvg + 0.3) trend = 'improving';
  else if (recentAvg < olderAvg - 0.3) trend = 'declining';

  // Generate insights and recommendations
  const insights = generateInsights(moodScore, physicalScore, socialScore, medicationScore);
  const recommendations = generateRecommendations(moodScore, physicalScore, socialScore, medicationScore);

  return {
    overall: overallScore,
    mood: moodScore,
    physical: physicalScore,
    social: socialScore,
    medication: medicationScore,
    trend,
    insights,
    recommendations,
    lastCalculated: new Date().toISOString()
  };
}

/**
 * Helper function to detect anomalies
 */
function detectAnomalies(baseline, recent) {
  const anomalies = [];

  if (!baseline || !recent) return anomalies;

  // Check for significant mood drop
  if (baseline.avg_mood && recent.avg_mood && recent.avg_mood < baseline.avg_mood - 1.5) {
    anomalies.push({
      type: 'mood_decline',
      severity: 'medium',
      description: 'Significant decline in mood ratings detected',
      context: { baseline: baseline.avg_mood, recent: recent.avg_mood },
      confidence: 0.85
    });
  }

  // Check for energy level drop
  if (baseline.avg_energy && recent.avg_energy && recent.avg_energy < baseline.avg_energy - 1.5) {
    anomalies.push({
      type: 'energy_decline',
      severity: 'medium',
      description: 'Significant decline in energy levels detected',
      context: { baseline: baseline.avg_energy, recent: recent.avg_energy },
      confidence: 0.80
    });
  }

  // Check for sleep quality issues
  if (baseline.avg_sleep && recent.avg_sleep && recent.avg_sleep < baseline.avg_sleep - 1.0) {
    anomalies.push({
      type: 'sleep_issues',
      severity: 'low',
      description: 'Sleep quality appears to be declining',
      context: { baseline: baseline.avg_sleep, recent: recent.avg_sleep },
      confidence: 0.75
    });
  }

  // Check for missed check-ins
  if (recent.total_checkins < 5) {
    anomalies.push({
      type: 'missed_checkins',
      severity: 'low',
      description: 'Fewer daily check-ins completed than usual',
      context: { recent_checkins: recent.total_checkins },
      confidence: 0.90
    });
  }

  return anomalies;
}

/**
 * Helper function to generate insights
 */
function generateInsights(moodScore, physicalScore, socialScore, medicationScore) {
  const insights = [];

  if (moodScore < 60) {
    insights.push({
      type: 'mood_concern',
      message: 'Your mood scores have been lower than optimal. Consider discussing this with your healthcare provider.',
      priority: 'medium'
    });
  }

  if (physicalScore < 50) {
    insights.push({
      type: 'physical_concern',
      message: 'Physical wellness indicators suggest you may need additional support or medical attention.',
      priority: 'high'
    });
  }

  if (socialScore < 40) {
    insights.push({
      type: 'social_isolation',
      message: 'Limited social interaction detected. Consider connecting with family or friends.',
      priority: 'medium'
    });
  }

  if (medicationScore < 80) {
    insights.push({
      type: 'medication_adherence',
      message: 'Medication compliance could be improved. Consider setting additional reminders.',
      priority: 'high'
    });
  }

  return insights;
}

/**
 * Helper function to generate recommendations
 */
function generateRecommendations(moodScore, physicalScore, socialScore, medicationScore) {
  const recommendations = [];

  if (moodScore < 70) {
    recommendations.push({
      category: 'mental_health',
      action: 'Consider light physical activity or talking with a counselor',
      impact: 'mood improvement',
      effort: 'low'
    });
  }

  if (physicalScore < 60) {
    recommendations.push({
      category: 'physical_health',
      action: 'Schedule a check-up with your doctor',
      impact: 'overall health',
      effort: 'medium'
    });
  }

  if (socialScore < 50) {
    recommendations.push({
      category: 'social_wellness',
      action: 'Plan a video call with family or join a community activity',
      impact: 'social connection',
      effort: 'low'
    });
  }

  if (medicationScore < 85) {
    recommendations.push({
      category: 'medication_management',
      action: 'Set up additional medication reminders or use a pill organizer',
      impact: 'medication adherence',
      effort: 'low'
    });
  }

  return recommendations;
}

/**
 * Helper function to generate AI insights
 */
function generateAIInsights(userData, patterns, medicationPatterns) {
  return {
    userProfile: {
      age: userData.age,
      riskFactors: generateRiskFactors(userData.age, patterns),
      healthGoals: generateHealthGoals(patterns)
    },
    patternAnalysis: {
      moodTrends: analyzeMoodTrends(patterns),
      sleepPatterns: analyzeSleepPatterns(patterns),
      activityLevels: analyzeActivityLevels(patterns)
    },
    medicationInsights: {
      adherencePatterns: analyzeMedicationAdherence(medicationPatterns),
      recommendations: generateMedicationRecommendations(medicationPatterns)
    },
    predictions: {
      riskAssessment: generateRiskAssessment(patterns),
      recommendations: generatePersonalizedRecommendations(userData, patterns)
    }
  };
}

/**
 * Helper function to generate predictive analytics
 */
function generatePredictiveAnalytics(historicalData, vitalsData) {
  return {
    healthTrends: {
      mood: predictTrend(historicalData.map(d => d.mood_rating)),
      energy: predictTrend(historicalData.map(d => d.energy_level)),
      sleep: predictTrend(historicalData.map(d => d.sleep_quality))
    },
    riskPredictions: {
      fallRisk: calculateFallRisk(historicalData, vitalsData),
      healthDeteriorationRisk: calculateHealthRisk(historicalData)
    },
    recommendations: {
      preventive: generatePreventiveRecommendations(historicalData),
      lifestyle: generateLifestyleRecommendations(historicalData)
    }
  };
}

// Placeholder implementations for helper functions
function generateRiskFactors(age, patterns) { return []; }
function generateHealthGoals(patterns) { return []; }
function analyzeMoodTrends(patterns) { return {}; }
function analyzeSleepPatterns(patterns) { return {}; }
function analyzeActivityLevels(patterns) { return {}; }
function analyzeMedicationAdherence(patterns) { return {}; }
function generateMedicationRecommendations(patterns) { return []; }
function generateRiskAssessment(patterns) { return {}; }
function generatePersonalizedRecommendations(userData, patterns) { return []; }
function predictTrend(values) { return 'stable'; }
function calculateFallRisk(historical, vitals) { return 'low'; }
function calculateHealthRisk(historical) { return 'low'; }
function generatePreventiveRecommendations(historical) { return []; }
function generateLifestyleRecommendations(historical) { return []; }

module.exports = router;