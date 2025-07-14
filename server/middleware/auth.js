const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');
const { logger } = require('../utils/logger');
const { 
  AuthenticationError, 
  AuthorizationError, 
  asyncHandler 
} = require('./errorHandler');

// JWT secret and options
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Extract token from request
const extractToken = (req) => {
  let token = null;
  
  // Check Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // Check cookies
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // Check query parameter (for WebSocket connections)
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  
  return token;
};

// Get user from database
const getUserFromDatabase = async (userId) => {
  try {
    const db = getDB();
    
    // Find user by ID
    const user = await db.collection('users').findOne(
      { id: userId, is_active: true },
      { projection: { password_hash: 0 } } // Exclude password hash
    );
    
    if (!user) {
      return null;
    }
    
    // Get family connections for this user
    const familyConnections = await db.collection('family_connections').find({
      $or: [
        { senior_id: userId },
        { caregiver_id: userId }
      ],
      status: 'active'
    }).toArray();
    
    // Add family connections to user object
    user.family_connections = familyConnections;
    
    return user;
  } catch (error) {
    logger.error('Error fetching user from database:', error);
    return null;
  }
};

// Main authentication middleware
const authenticate = asyncHandler(async (req, res, next) => {
  // Extract token
  const token = extractToken(req);
  
  if (!token) {
    logger.auth('No token provided', null, { ip: req.ip, userAgent: req.get('user-agent') });
    throw new AuthenticationError('No token provided');
  }
  
  try {
    // Verify JWT token
    const decoded = verifyToken(token);
    
    // Skip Redis blacklist check for now (Redis not available)
    // TODO: Implement blacklist checking when Redis is available
    
    // Get user from database
    const user = await getUserFromDatabase(decoded.userId);
    
    if (!user) {
      logger.auth('User not found for token', decoded.userId, { token: token.substring(0, 10) + '...' });
      throw new AuthenticationError('User not found');
    }
    
    // Check if user is active
    if (!user.is_active) {
      logger.auth('Inactive user attempted access', user.id, { email: user.email });
      throw new AuthenticationError('User account is inactive');
    }
    
    // Check subscription status for premium features
    if (user.subscription_tier === 'premium' && user.subscription_expires_at) {
      const expirationDate = new Date(user.subscription_expires_at);
      if (expirationDate < new Date()) {
        user.subscription_tier = 'free';
        // Update in database
        const db = getDB();
        await db.collection('users').updateOne(
          { id: user.id },
          { $set: { subscription_tier: 'free', updated_at: new Date() } }
        );
      }
    }
    
    // Attach user to request
    req.user = user;
    req.token = token;
    
    // Log successful authentication
    logger.auth('User authenticated successfully', user.id, { 
      email: user.email, 
      role: user.role,
      ip: req.ip 
    });
    
    // Skip session refresh for now (Redis not available)
    // TODO: Implement session management when Redis is available
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      logger.auth('Invalid token', null, { 
        error: error.message, 
        token: token.substring(0, 10) + '...',
        ip: req.ip 
      });
      throw new AuthenticationError('Invalid or expired token');
    }
    throw error;
  }
});

// Optional authentication (for public endpoints that benefit from user context)
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  
  if (!token) {
    return next();
  }
  
  try {
    const decoded = verifyToken(token);
    const user = await getUserFromDatabase(decoded.userId);
    
    if (user && user.is_active) {
      req.user = user;
      req.token = token;
    }
  } catch (error) {
    // Ignore errors for optional authentication
    logger.debug('Optional authentication failed', { error: error.message });
  }
  
  next();
});

// Role-based authorization
const authorize = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }
    
    if (!roles.includes(req.user.role)) {
      logger.auth('Insufficient permissions', req.user.id, { 
        requiredRoles: roles, 
        userRole: req.user.role,
        resource: req.originalUrl 
      });
      throw new AuthorizationError(`Access denied. Required roles: ${roles.join(', ')}`);
    }
    
    next();
  });
};

// Family connection authorization
const authorizeFamily = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  
  const targetUserId = req.params.userId || req.params.seniorId;
  
  if (!targetUserId) {
    throw new AuthorizationError('User ID required');
  }
  
  // User can always access their own data
  if (req.user.id === targetUserId) {
    return next();
  }
  
  // Check family connections
  const hasConnection = req.user.family_connections?.some(connection => 
    (connection.senior_id === targetUserId || connection.caregiver_id === targetUserId) &&
    connection.status === 'active'
  );
  
  if (!hasConnection) {
    logger.auth('Unauthorized family access attempt', req.user.id, {
      targetUserId,
      resource: req.originalUrl
    });
    throw new AuthorizationError('Not authorized to access this family member\'s data');
  }
  
  next();
});

// Premium feature authorization
const requirePremium = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  
  if (req.user.subscription_tier !== 'premium') {
    logger.auth('Premium feature access denied', req.user.id, {
      currentTier: req.user.subscription_tier,
      resource: req.originalUrl
    });
    throw new AuthorizationError('Premium subscription required');
  }
  
  next();
});

// Emergency access (bypasses some restrictions)
const emergencyAccess = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  
  // Emergency access requires special permission
  if (!req.user.emergency_access_enabled) {
    throw new AuthorizationError('Emergency access not enabled');
  }
  
  // Log emergency access
  logger.emergency('Emergency access granted', req.user.id, `Emergency access to ${req.originalUrl}`);
  
  next();
});

// HIPAA compliance middleware
const requireHIPAACompliance = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  
  // Check if user has HIPAA training
  if (!req.user.hipaa_trained) {
    logger.privacy('HIPAA access denied', 'PHI', req.user.id, {
      reason: 'User not HIPAA trained',
      resource: req.originalUrl
    });
    throw new AuthorizationError('HIPAA training required to access this resource');
  }
  
  // Log HIPAA-compliant access
  logger.privacy('HIPAA-compliant access granted', 'PHI', req.user.id, {
    resource: req.originalUrl
  });
  
  next();
});

// Rate limiting per user (simplified without Redis)
const rateLimitPerUser = (maxRequests = 100, windowMinutes = 15) => {
  return asyncHandler(async (req, res, next) => {
    // Skip rate limiting for now (Redis not available)
    // TODO: Implement proper rate limiting when Redis is available
    next();
  });
};

// Logout (blacklist token)
const logout = asyncHandler(async (req, res, next) => {
  if (req.token) {
    // Skip token blacklisting for now (Redis not available)
    // TODO: Implement token blacklisting when Redis is available
    
    // Log user logout
    if (req.user) {
      logger.auth('User logged out', req.user.id);
    }
  }
  
  next();
});

// Firebase authentication integration (commented out for now)
const authenticateWithFirebase = asyncHandler(async (req, res, next) => {
  // Firebase integration not available - return error
  throw new AuthenticationError('Firebase authentication not available');
});

module.exports = {
  // Token utilities
  generateToken,
  verifyToken,
  extractToken,
  
  // Authentication middleware
  authenticate,
  optionalAuthenticate,
  authenticateWithFirebase,
  
  // Authorization middleware
  authorize,
  authorizeFamily,
  requirePremium,
  emergencyAccess,
  requireHIPAACompliance,
  
  // Utility middleware
  rateLimitPerUser,
  logout,
  
  // Helper functions
  getUserFromDatabase
};