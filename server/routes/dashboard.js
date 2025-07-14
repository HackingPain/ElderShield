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
    const totalMedications = await db.collection('medications').countDocuments({ is_active: true });

    return {
      user: { id: userId, role: 'admin' },
      systemStats: {
        totalUsers,
        totalCheckIns,
        totalMedications
      },
      systemHealth: 'operational',
      alerts: []
    };
  } catch (error) {
    logger.error('Error getting admin dashboard:', error);
    throw error;
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