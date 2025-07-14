const express = require('express');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @route GET /api/dashboard
 * @desc Get dashboard data for authenticated user
 * @access Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  let dashboardData;

  if (userRole === 'senior') {
    dashboardData = await getSeniorDashboard(userId);
  } else if (userRole === 'caregiver') {
    dashboardData = await getCaregiverDashboard(userId);
  } else {
    dashboardData = await getAdminDashboard(userId);
  }

  res.json(dashboardData);
}));

/**
 * @route GET /api/dashboard/senior/:seniorId
 * @desc Get specific senior's dashboard data (for caregivers)
 * @access Private (Caregivers only)
 */
router.get('/senior/:seniorId', authenticate, asyncHandler(async (req, res) => {
  const { seniorId } = req.params;
  const caregiverId = req.user.id;

  // Verify caregiver has access to this senior
  const connection = await pool.query(
    'SELECT id FROM family_connections WHERE senior_id = $1 AND caregiver_id = $2 AND status = $3',
    [seniorId, caregiverId, 'active']
  );

  if (connection.rows.length === 0) {
    return res.status(403).json({ error: 'Access denied to this senior\'s data' });
  }

  const dashboardData = await getSeniorDashboard(seniorId);
  res.json(dashboardData);
}));

/**
 * @route GET /api/dashboard/wellness-summary
 * @desc Get wellness summary for the past week
 * @access Private
 */
router.get('/wellness-summary', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { days = 7 } = req.query;

  const result = await pool.query(
    `SELECT 
      date,
      mood_rating,
      energy_level,
      pain_level,
      sleep_quality,
      appetite_rating,
      hydration_glasses,
      exercise_minutes,
      medications_taken,
      social_interaction
    FROM daily_checkins 
    WHERE user_id = $1 
    AND date >= CURRENT_DATE - INTERVAL '${days} days'
    ORDER BY date DESC`,
    [userId]
  );

  const checkIns = result.rows;
  
  // Calculate averages and trends
  const summary = calculateWellnessSummary(checkIns);

  res.json(summary);
}));

/**
 * @route GET /api/dashboard/upcoming-events
 * @desc Get upcoming events and reminders
 * @access Private
 */
router.get('/upcoming-events', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get upcoming medication reminders
  const medicationReminders = await pool.query(
    `SELECT 
      mr.id, mr.scheduled_time, m.name, m.dosage
    FROM medication_reminders mr
    JOIN medications m ON mr.medication_id = m.id
    WHERE mr.user_id = $1 
    AND mr.scheduled_time BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
    AND mr.taken_at IS NULL
    AND mr.skipped = false
    AND m.is_active = true
    ORDER BY mr.scheduled_time ASC
    LIMIT 10`,
    [userId]
  );

  // Get upcoming calendar events
  const calendarEvents = await pool.query(
    `SELECT 
      id, title, description, event_type, start_time, end_time, location
    FROM calendar_events
    WHERE user_id = $1 
    AND start_time BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    ORDER BY start_time ASC
    LIMIT 10`,
    [userId]
  );

  res.json({
    medicationReminders: medicationReminders.rows,
    calendarEvents: calendarEvents.rows
  });
}));

/**
 * Get senior dashboard data
 */
// Helper function: Get senior dashboard data
async function getSeniorDashboard(userId) {
  try {
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];

    // Get today's check-in status
    const todayCheckIn = await db.collection('daily_checkins').findOne({
      user_id: userId,
      check_date: today
    });

    // Get recent medications
    const medications = await db.collection('medications').find({
      user_id: userId,
      is_active: true
    }).limit(5).toArray();

    // Get unread messages count
    const unreadMessagesCount = await db.collection('messages').countDocuments({
      recipient_id: userId,
      is_read: false
    });

    // Get recent check-ins for trend
    const recentCheckIns = await db.collection('daily_checkins').find({
      user_id: userId
    }).sort({ check_date: -1 }).limit(7).toArray();

    return {
      user: { id: userId, role: 'senior' },
      checkInStatus: {
        completedToday: !!todayCheckIn,
        lastCheckIn: todayCheckIn,
        streak: recentCheckIns.length
      },
      medications: {
        totalActive: medications.length,
        upcomingReminders: medications.slice(0, 3)
      },
      messages: {
        unreadCount: unreadMessagesCount
      },
      wellness: {
        overallScore: todayCheckIn?.mood_rating || null,
        trend: recentCheckIns.length > 0 ? 'improving' : 'stable'
      },
      recentActivity: recentCheckIns.slice(0, 3),
      alerts: []
    };
  } catch (error) {
    logger.error('Error getting senior dashboard:', error);
    throw error;
  }
}

// Helper function: Get caregiver dashboard data  
async function getCaregiverDashboard(userId) {
  try {
    const db = getDB();

    // Get family connections for this caregiver
    const familyConnections = await db.collection('family_connections').find({
      caregiver_id: userId,
      status: 'active'
    }).toArray();

    const seniorIds = familyConnections.map(fc => fc.senior_id);

    // Get seniors info
    const seniors = await db.collection('users').find({
      id: { $in: seniorIds },
      is_active: true
    }).toArray();

    // Get recent check-ins from seniors
    const recentCheckIns = await db.collection('daily_checkins').find({
      user_id: { $in: seniorIds }
    }).sort({ created_at: -1 }).limit(10).toArray();

    return {
      user: { id: userId, role: 'caregiver' },
      familyMembers: seniors,
      recentActivity: recentCheckIns,
      alerts: [],
      summary: {
        totalSeniors: seniors.length,
        recentCheckIns: recentCheckIns.length
      }
    };
  } catch (error) {
    logger.error('Error getting caregiver dashboard:', error);
    throw error;
  }
}

// Helper function: Get admin dashboard data
async function getAdminDashboard(userId) {
  try {
    const db = getDB();

    // Get basic stats
    const totalUsers = await db.collection('users').countDocuments({ is_active: true });
    const totalCheckIns = await db.collection('daily_checkins').countDocuments();

    return {
      totalUsers,
      totalCheckIns,
      systemHealth: 'operational',
      alerts: []
    };
  } catch (error) {
    logger.error('Error getting admin dashboard:', error);
    throw error;
  }
}

    // Active family connections
    const familyConnections = await client.query(
      `SELECT 
        u.id, u.first_name, u.last_name, u.profile_picture_url, fc.relationship
       FROM family_connections fc
       JOIN users u ON fc.caregiver_id = u.id
       WHERE fc.senior_id = $1 AND fc.status = 'active'`,
      [userId]
    );

    // Check-in streak
    const checkInStreak = await calculateCheckInStreak(client, userId);

    return {
      user: {
        id: userId,
        role: 'senior'
      },
      todayCheckIn: todayCheckIn.rows[0] || null,
      hasCheckedInToday: todayCheckIn.rows.length > 0,
      wellnessScores: wellnessScores.rows,
      upcomingMedications: upcomingMeds.rows,
      unreadMessagesCount: parseInt(unreadMessages.rows[0].count),
      medicationAdherence: {
        total: parseInt(medicationAdherence.rows[0].total),
        taken: parseInt(medicationAdherence.rows[0].taken),
        percentage: medicationAdherence.rows[0].total > 0 
          ? Math.round((medicationAdherence.rows[0].taken / medicationAdherence.rows[0].total) * 100)
          : 0
      },
      recentVitals: recentVitals.rows,
      familyConnections: familyConnections.rows,
      checkInStreak: checkInStreak
    };

  } finally {
    client.release();
  }
}

/**
 * Get caregiver dashboard data
 */
async function getCaregiverDashboard(userId) {
  const client = await pool.connect();
  try {
    // Get all seniors this caregiver is connected to
    const seniors = await client.query(
      `SELECT 
        u.id, u.first_name, u.last_name, u.profile_picture_url,
        fc.relationship, fc.permissions
       FROM family_connections fc
       JOIN users u ON fc.senior_id = u.id
       WHERE fc.caregiver_id = $1 AND fc.status = 'active'
       ORDER BY u.first_name, u.last_name`,
      [userId]
    );

    const seniorIds = seniors.rows.map(s => s.id);
    
    if (seniorIds.length === 0) {
      return {
        user: { id: userId, role: 'caregiver' },
        seniors: [],
        alerts: [],
        recentActivity: []
      };
    }

    // Recent alerts and anomalies
    const alerts = await client.query(
      `SELECT 
        aa.id, aa.user_id, aa.anomaly_type, aa.severity, aa.description,
        aa.created_at, u.first_name, u.last_name
       FROM anomaly_alerts aa
       JOIN users u ON aa.user_id = u.id
       WHERE aa.user_id = ANY($1) 
       AND aa.status = 'active'
       ORDER BY aa.created_at DESC
       LIMIT 10`,
      [seniorIds]
    );

    // Emergency alerts
    const emergencyAlerts = await client.query(
      `SELECT 
        ea.id, ea.user_id, ea.alert_type, ea.severity, ea.message,
        ea.created_at, u.first_name, u.last_name
       FROM emergency_alerts ea
       JOIN users u ON ea.user_id = u.id
       WHERE ea.user_id = ANY($1) 
       AND ea.status = 'active'
       ORDER BY ea.created_at DESC
       LIMIT 5`,
      [seniorIds]
    );

    // Recent check-ins summary
    const today = new Date().toISOString().split('T')[0];
    const checkInSummary = await client.query(
      `SELECT 
        dc.user_id, dc.mood_rating, dc.energy_level, dc.pain_level,
        dc.completed_at, u.first_name, u.last_name
       FROM daily_checkins dc
       JOIN users u ON dc.user_id = u.id
       WHERE dc.user_id = ANY($1) 
       AND dc.date = $2`,
      [seniorIds, today]
    );

    // Missed check-ins (seniors who haven't checked in today)
    const missedCheckIns = seniors.rows.filter(senior => 
      !checkInSummary.rows.find(checkIn => checkIn.user_id === senior.id)
    );

    // Recent messages
    const recentMessages = await client.query(
      `SELECT 
        m.id, m.sender_id, m.message_text, m.message_type, m.created_at,
        u.first_name, u.last_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.recipient_id = $1
       AND m.read_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 10`,
      [userId]
    );

    return {
      user: { id: userId, role: 'caregiver' },
      seniors: seniors.rows,
      alerts: [...alerts.rows, ...emergencyAlerts.rows].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      ),
      checkInSummary: checkInSummary.rows,
      missedCheckIns: missedCheckIns,
      recentMessages: recentMessages.rows,
      unreadMessagesCount: recentMessages.rows.length
    };

  } finally {
    client.release();
  }
}

/**
 * Get admin dashboard data
 */
async function getAdminDashboard(userId) {
  const client = await pool.connect();
  try {
    // System statistics
    const userStats = await client.query(
      `SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'senior' THEN 1 END) as seniors,
        COUNT(CASE WHEN role = 'caregiver' THEN 1 END) as caregivers,
        COUNT(CASE WHEN subscription_tier = 'premium' THEN 1 END) as premium_users,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_30d
       FROM users 
       WHERE is_active = true`
    );

    // Platform activity
    const activityStats = await client.query(
      `SELECT 
        (SELECT COUNT(*) FROM daily_checkins WHERE date = CURRENT_DATE) as checkins_today,
        (SELECT COUNT(*) FROM messages WHERE DATE(created_at) = CURRENT_DATE) as messages_today,
        (SELECT COUNT(*) FROM emergency_alerts WHERE DATE(created_at) = CURRENT_DATE) as alerts_today,
        (SELECT COUNT(*) FROM medication_reminders WHERE DATE(scheduled_time) = CURRENT_DATE) as med_reminders_today`
    );

    // Recent emergency alerts
    const recentAlerts = await client.query(
      `SELECT 
        ea.id, ea.user_id, ea.alert_type, ea.severity, ea.message, ea.created_at,
        u.first_name, u.last_name
       FROM emergency_alerts ea
       JOIN users u ON ea.user_id = u.id
       ORDER BY ea.created_at DESC
       LIMIT 10`
    );

    return {
      user: { id: userId, role: 'admin' },
      userStats: userStats.rows[0],
      activityStats: activityStats.rows[0],
      recentAlerts: recentAlerts.rows
    };

  } finally {
    client.release();
  }
}

/**
 * Calculate check-in streak for a user
 */
async function calculateCheckInStreak(client, userId) {
  const result = await client.query(
    `SELECT date 
     FROM daily_checkins 
     WHERE user_id = $1 
     AND date >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY date DESC`,
    [userId]
  );

  let currentStreak = 0;
  const today = new Date();
  const checkInDates = result.rows.map(row => new Date(row.date));

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const hasCheckIn = checkInDates.some(checkInDate => 
      checkInDate.toDateString() === date.toDateString()
    );

    if (hasCheckIn) {
      if (i === 0 || currentStreak > 0) {
        currentStreak++;
      }
    } else if (i === 0) {
      currentStreak = 0;
      break;
    } else {
      break;
    }
  }

  return {
    current: currentStreak,
    total: result.rows.length
  };
}

/**
 * Calculate wellness summary from check-ins
 */
function calculateWellnessSummary(checkIns) {
  if (checkIns.length === 0) {
    return {
      averages: {},
      trends: {},
      totalDays: 0
    };
  }

  const totals = checkIns.reduce((acc, checkIn) => {
    acc.mood += checkIn.mood_rating || 0;
    acc.energy += checkIn.energy_level || 0;
    acc.pain += checkIn.pain_level || 0;
    acc.sleep += checkIn.sleep_quality || 0;
    acc.appetite += checkIn.appetite_rating || 0;
    acc.hydration += checkIn.hydration_glasses || 0;
    acc.exercise += checkIn.exercise_minutes || 0;
    acc.medicationDays += checkIn.medications_taken ? 1 : 0;
    acc.socialDays += checkIn.social_interaction ? 1 : 0;
    return acc;
  }, {
    mood: 0, energy: 0, pain: 0, sleep: 0, appetite: 0,
    hydration: 0, exercise: 0, medicationDays: 0, socialDays: 0
  });

  const count = checkIns.length;

  return {
    averages: {
      mood: (totals.mood / count).toFixed(1),
      energy: (totals.energy / count).toFixed(1),
      pain: (totals.pain / count).toFixed(1),
      sleep: (totals.sleep / count).toFixed(1),
      appetite: (totals.appetite / count).toFixed(1),
      hydration: (totals.hydration / count).toFixed(1),
      exercise: Math.round(totals.exercise / count)
    },
    compliance: {
      medication: ((totals.medicationDays / count) * 100).toFixed(1),
      social: ((totals.socialDays / count) * 100).toFixed(1)
    },
    trends: checkIns.reverse().map(checkIn => ({
      date: checkIn.date,
      mood: checkIn.mood_rating,
      energy: checkIn.energy_level,
      pain: checkIn.pain_level
    })),
    totalDays: count
  };
}

module.exports = router;