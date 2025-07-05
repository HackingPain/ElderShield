const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.simple()
    ),
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  levels,
  format,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/rejections.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Enhanced logging methods
const enhancedLogger = {
  // Standard log levels
  error: (message, meta = {}) => {
    logger.error(message, meta);
  },
  
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },
  
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },
  
  http: (message, meta = {}) => {
    logger.http(message, meta);
  },
  
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },

  // Security-related logging
  security: (message, meta = {}) => {
    logger.error(`[SECURITY] ${message}`, {
      ...meta,
      type: 'security',
      timestamp: new Date().toISOString(),
    });
  },

  // Authentication logging
  auth: (message, userId = null, meta = {}) => {
    logger.info(`[AUTH] ${message}`, {
      ...meta,
      userId,
      type: 'authentication',
      timestamp: new Date().toISOString(),
    });
  },

  // API request logging
  apiRequest: (req, res, responseTime) => {
    const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`;
    const meta = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: req.user?.id || null,
      type: 'api_request',
      timestamp: new Date().toISOString(),
    };

    if (res.statusCode >= 400) {
      logger.error(message, meta);
    } else {
      logger.http(message, meta);
    }
  },

  // Database operation logging
  database: (operation, table, meta = {}) => {
    logger.debug(`[DATABASE] ${operation} on ${table}`, {
      ...meta,
      operation,
      table,
      type: 'database',
      timestamp: new Date().toISOString(),
    });
  },

  // Medication logging
  medication: (action, medicationId, userId, meta = {}) => {
    logger.info(`[MEDICATION] ${action} - Medication: ${medicationId}, User: ${userId}`, {
      ...meta,
      action,
      medicationId,
      userId,
      type: 'medication',
      timestamp: new Date().toISOString(),
    });
  },

  // Emergency alert logging
  emergency: (alertType, userId, message, meta = {}) => {
    logger.error(`[EMERGENCY] ${alertType} - User: ${userId} - ${message}`, {
      ...meta,
      alertType,
      userId,
      message,
      type: 'emergency',
      timestamp: new Date().toISOString(),
    });
  },

  // Wellness scoring logging
  wellness: (userId, score, anomalies = [], meta = {}) => {
    logger.info(`[WELLNESS] User: ${userId} - Score: ${score} - Anomalies: ${anomalies.length}`, {
      ...meta,
      userId,
      score,
      anomalies,
      type: 'wellness',
      timestamp: new Date().toISOString(),
    });
  },

  // Payment/subscription logging
  payment: (action, userId, amount, meta = {}) => {
    logger.info(`[PAYMENT] ${action} - User: ${userId} - Amount: ${amount}`, {
      ...meta,
      action,
      userId,
      amount,
      type: 'payment',
      timestamp: new Date().toISOString(),
    });
  },

  // Performance logging
  performance: (operation, duration, meta = {}) => {
    const message = `[PERFORMANCE] ${operation} took ${duration}ms`;
    const logMeta = {
      ...meta,
      operation,
      duration,
      type: 'performance',
      timestamp: new Date().toISOString(),
    };

    if (duration > 5000) {
      logger.warn(message, logMeta);
    } else {
      logger.debug(message, logMeta);
    }
  },

  // Data privacy logging (HIPAA compliance)
  privacy: (action, dataType, userId, meta = {}) => {
    logger.info(`[PRIVACY] ${action} - Data: ${dataType} - User: ${userId}`, {
      ...meta,
      action,
      dataType,
      userId,
      type: 'privacy',
      timestamp: new Date().toISOString(),
    });
  },

  // Integration logging (IoT devices, third-party APIs)
  integration: (service, action, meta = {}) => {
    logger.info(`[INTEGRATION] ${service} - ${action}`, {
      ...meta,
      service,
      action,
      type: 'integration',
      timestamp: new Date().toISOString(),
    });
  },

  // Audit logging for compliance
  audit: (action, userId, resourceType, resourceId, meta = {}) => {
    logger.info(`[AUDIT] ${action} - User: ${userId} - Resource: ${resourceType}/${resourceId}`, {
      ...meta,
      action,
      userId,
      resourceType,
      resourceId,
      type: 'audit',
      timestamp: new Date().toISOString(),
    });
  }
};

// HTTP request logging middleware
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    enhancedLogger.apiRequest(req, res, duration);
  });
  
  next();
};

// Error logging middleware
const errorLogger = (error, req, res, next) => {
  const meta = {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || null,
    body: req.body,
    params: req.params,
    query: req.query,
  };

  enhancedLogger.error(`API Error: ${error.message}`, meta);
  next(error);
};

module.exports = {
  logger: enhancedLogger,
  httpLogger,
  errorLogger,
  winston: logger // Export original winston instance if needed
};