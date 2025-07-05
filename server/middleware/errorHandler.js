const { logger } = require('../utils/logger');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
    this.type = 'validation';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.type = 'authentication';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Not authorized to access this resource') {
    super(message, 403);
    this.type = 'authorization';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.type = 'not_found';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
    this.type = 'conflict';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.type = 'rate_limit';
  }
}

class HIPAAError extends AppError {
  constructor(message = 'HIPAA compliance violation') {
    super(message, 451);
    this.type = 'hipaa_violation';
  }
}

// Handle specific error types
const handleDatabaseError = (error) => {
  logger.error('Database error:', error);
  
  if (error.code === '23505') {
    // Unique constraint violation
    return new ConflictError('Resource already exists');
  }
  
  if (error.code === '23503') {
    // Foreign key constraint violation
    return new ValidationError('Invalid reference to related resource');
  }
  
  if (error.code === '23502') {
    // Not null constraint violation
    return new ValidationError('Required field is missing');
  }
  
  if (error.code === '22001') {
    // String data too long
    return new ValidationError('Data too long for field');
  }
  
  return new AppError('Database operation failed', 500, false);
};

const handleJWTError = (error) => {
  logger.security('JWT authentication error:', { error: error.message });
  
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }
  
  return new AuthenticationError('Authentication failed');
};

const handleValidationError = (error) => {
  const errors = [];
  
  if (error.details) {
    // Joi validation error
    error.details.forEach(detail => {
      errors.push({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      });
    });
  }
  
  return new ValidationError('Validation failed', errors);
};

const handleFirebaseError = (error) => {
  logger.error('Firebase error:', error);
  
  if (error.code === 'auth/user-not-found') {
    return new NotFoundError('User not found');
  }
  
  if (error.code === 'auth/email-already-exists') {
    return new ConflictError('Email already exists');
  }
  
  if (error.code === 'auth/invalid-email') {
    return new ValidationError('Invalid email format');
  }
  
  if (error.code === 'auth/weak-password') {
    return new ValidationError('Password is too weak');
  }
  
  return new AppError('Authentication service error', 500, false);
};

const handleRedisError = (error) => {
  logger.error('Redis error:', error);
  return new AppError('Cache service error', 500, false);
};

const handleTwilioError = (error) => {
  logger.error('Twilio error:', error);
  return new AppError('Communication service error', 500, false);
};

// Send error response
const sendErrorResponse = (error, req, res) => {
  const { statusCode, message, type, errors } = error;
  
  // Log the error with context
  const errorContext = {
    error: message,
    stack: error.stack,
    statusCode,
    type,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || null,
    timestamp: new Date().toISOString(),
  };
  
  if (statusCode >= 500) {
    logger.error('Server error:', errorContext);
  } else {
    logger.warn('Client error:', errorContext);
  }
  
  // Security logging for authentication/authorization errors
  if (type === 'authentication' || type === 'authorization') {
    logger.security(`${type} error: ${message}`, errorContext);
  }
  
  // HIPAA compliance logging
  if (type === 'hipaa_violation') {
    logger.privacy('HIPAA violation detected', 'unknown', req.user?.id || 'anonymous', errorContext);
  }
  
  // Development vs production error responses
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse = {
    status: error.status || 'error',
    message: message,
    ...(type && { type }),
    ...(errors && { errors }),
    ...(isDevelopment && { stack: error.stack }),
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown',
  };
  
  res.status(statusCode).json(errorResponse);
};

// Main error handler middleware
const errorHandler = (error, req, res, next) => {
  let err = error;
  
  // Handle specific error types
  if (error.name === 'ValidationError' && error.details) {
    err = handleValidationError(error);
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    err = handleJWTError(error);
  } else if (error.code && error.code.startsWith('23')) {
    err = handleDatabaseError(error);
  } else if (error.code && error.code.startsWith('auth/')) {
    err = handleFirebaseError(error);
  } else if (error.code === 'ECONNREFUSED' && error.address) {
    if (error.port === 6379) {
      err = handleRedisError(error);
    } else {
      err = new AppError('Service connection failed', 503, false);
    }
  } else if (error.code === 20003) {
    err = handleTwilioError(error);
  } else if (!error.isOperational) {
    // Programming errors
    err = new AppError('Something went wrong', 500, false);
  }
  
  sendErrorResponse(err, req, res);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// HIPAA compliance checker
const checkHIPAACompliance = (req, res, next) => {
  // Check if request contains PHI (Protected Health Information)
  const containsPHI = (data) => {
    if (!data || typeof data !== 'object') return false;
    
    const phiFields = [
      'ssn', 'social_security_number', 'medical_record_number',
      'health_plan_id', 'account_number', 'certificate_number',
      'license_number', 'vehicle_identifier', 'device_identifier',
      'biometric_identifier', 'full_face_photo', 'finger_print',
      'voice_print', 'iris_scan', 'genetic_information'
    ];
    
    return phiFields.some(field => 
      Object.keys(data).some(key => 
        key.toLowerCase().includes(field.toLowerCase())
      )
    );
  };
  
  if (containsPHI(req.body) || containsPHI(req.query)) {
    // Log HIPAA-related data access
    logger.privacy('PHI data accessed', 'mixed', req.user?.id || 'anonymous', {
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
    
    // Verify user has appropriate permissions
    if (!req.user || !req.user.hipaa_trained) {
      return next(new HIPAAError('User not authorized to access PHI data'));
    }
  }
  
  next();
};

// Rate limiting error handler
const handleRateLimitError = (req, res, next) => {
  const error = new RateLimitError('Too many requests, please try again later');
  next(error);
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  HIPAAError,
  
  // Middleware
  errorHandler,
  notFoundHandler,
  asyncHandler,
  checkHIPAACompliance,
  handleRateLimitError,
  
  // Utility functions
  sendErrorResponse,
  handleDatabaseError,
  handleJWTError,
  handleValidationError,
  handleFirebaseError,
};