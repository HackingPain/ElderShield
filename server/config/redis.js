const redis = require('redis');
const logger = require('../utils/logger');

let redisClient;

const initializeRedis = async () => {
  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    };

    if (process.env.REDIS_URL) {
      redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
        },
      });
    } else {
      redisClient = redis.createClient(redisConfig);
    }

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Redis initialization failed:', error);
    throw error;
  }
};

// Cache helper functions
const cacheHelpers = {
  // Set cache with expiration
  async set(key, value, expirationInSeconds = 3600) {
    try {
      await redisClient.setEx(key, expirationInSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Error setting cache for key ${key}:`, error);
      return false;
    }
  },

  // Get cache
  async get(key) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Error getting cache for key ${key}:`, error);
      return null;
    }
  },

  // Delete cache
  async del(key) {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error(`Error deleting cache for key ${key}:`, error);
      return false;
    }
  },

  // Check if key exists
  async exists(key) {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  },

  // Set hash field
  async hset(key, field, value) {
    try {
      await redisClient.hSet(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Error setting hash field ${field} for key ${key}:`, error);
      return false;
    }
  },

  // Get hash field
  async hget(key, field) {
    try {
      const value = await redisClient.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Error getting hash field ${field} for key ${key}:`, error);
      return null;
    }
  },

  // Get all hash fields
  async hgetall(key) {
    try {
      const hash = await redisClient.hGetAll(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      return result;
    } catch (error) {
      logger.error(`Error getting all hash fields for key ${key}:`, error);
      return {};
    }
  },

  // Increment counter
  async incr(key) {
    try {
      return await redisClient.incr(key);
    } catch (error) {
      logger.error(`Error incrementing counter for key ${key}:`, error);
      return null;
    }
  },

  // Set expiration
  async expire(key, seconds) {
    try {
      await redisClient.expire(key, seconds);
      return true;
    } catch (error) {
      logger.error(`Error setting expiration for key ${key}:`, error);
      return false;
    }
  },

  // Add to set
  async sadd(key, member) {
    try {
      await redisClient.sAdd(key, member);
      return true;
    } catch (error) {
      logger.error(`Error adding to set ${key}:`, error);
      return false;
    }
  },

  // Remove from set
  async srem(key, member) {
    try {
      await redisClient.sRem(key, member);
      return true;
    } catch (error) {
      logger.error(`Error removing from set ${key}:`, error);
      return false;
    }
  },

  // Get set members
  async smembers(key) {
    try {
      return await redisClient.sMembers(key);
    } catch (error) {
      logger.error(`Error getting set members for key ${key}:`, error);
      return [];
    }
  },

  // Check if member exists in set
  async sismember(key, member) {
    try {
      return await redisClient.sIsMember(key, member);
    } catch (error) {
      logger.error(`Error checking set membership for key ${key}:`, error);
      return false;
    }
  }
};

// Session management
const sessionHelpers = {
  // Create user session
  async createSession(userId, sessionData) {
    const sessionKey = `session:${userId}`;
    await cacheHelpers.set(sessionKey, sessionData, 24 * 60 * 60); // 24 hours
    return sessionKey;
  },

  // Get user session
  async getSession(userId) {
    const sessionKey = `session:${userId}`;
    return await cacheHelpers.get(sessionKey);
  },

  // Delete user session
  async deleteSession(userId) {
    const sessionKey = `session:${userId}`;
    return await cacheHelpers.del(sessionKey);
  },

  // Update session expiration
  async refreshSession(userId) {
    const sessionKey = `session:${userId}`;
    return await cacheHelpers.expire(sessionKey, 24 * 60 * 60);
  }
};

// Rate limiting helpers
const rateLimitHelpers = {
  // Check rate limit
  async checkRateLimit(identifier, maxRequests = 100, windowInSeconds = 900) {
    const key = `rate_limit:${identifier}`;
    const current = await cacheHelpers.incr(key);
    
    if (current === 1) {
      await cacheHelpers.expire(key, windowInSeconds);
    }
    
    return current <= maxRequests;
  },

  // Get current rate limit count
  async getRateLimitCount(identifier) {
    const key = `rate_limit:${identifier}`;
    const count = await cacheHelpers.get(key);
    return count || 0;
  }
};

// Health check function
const checkRedisHealth = async () => {
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
};

module.exports = {
  initializeRedis,
  redisClient: () => redisClient,
  cacheHelpers,
  sessionHelpers,
  rateLimitHelpers,
  checkRedisHealth
};