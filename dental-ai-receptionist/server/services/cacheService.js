import NodeCache from 'node-cache';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

class CacheService {
  constructor() {
    // Initialize different cache stores for different purposes
    this.caches = {
      // Short-lived cache for API responses (5 minutes)
      api: new NodeCache({ stdTTL: 300, checkperiod: 60 }),
      
      // Medium-lived cache for user sessions (30 minutes)
      session: new NodeCache({ stdTTL: 1800, checkperiod: 120 }),
      
      // Long-lived cache for static data (1 hour)
      static: new NodeCache({ stdTTL: 3600, checkperiod: 300 }),
      
      // AI response cache (10 minutes)
      ai: new NodeCache({ stdTTL: 600, checkperiod: 120 }),
      
      // Appointment slots cache (2 minutes)
      appointments: new NodeCache({ stdTTL: 120, checkperiod: 30 })
    };
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    Object.entries(this.caches).forEach(([name, cache]) => {
      cache.on('expired', (key, value) => {
        logger.debug(`Cache expired: ${name}:${key}`);
      });
      
      cache.on('flush', () => {
        logger.info(`Cache flushed: ${name}`);
      });
    });
  }

  // Generate cache key from request parameters
  generateKey(prefix, params) {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    return `${prefix}:${hash}`;
  }

  // Get from cache
  async get(store, key) {
    try {
      const value = this.caches[store]?.get(key);
      if (value !== undefined) {
        this.stats.hits++;
        logger.debug(`Cache hit: ${store}:${key}`);
        return value;
      }
      this.stats.misses++;
      logger.debug(`Cache miss: ${store}:${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache get error: ${error.message}`);
      return null;
    }
  }

  // Set in cache
  async set(store, key, value, ttl) {
    try {
      const cache = this.caches[store];
      if (!cache) {
        throw new Error(`Cache store ${store} not found`);
      }
      
      const success = ttl 
        ? cache.set(key, value, ttl)
        : cache.set(key, value);
      
      if (success) {
        this.stats.sets++;
        logger.debug(`Cache set: ${store}:${key}`);
      }
      return success;
    } catch (error) {
      logger.error(`Cache set error: ${error.message}`);
      return false;
    }
  }

  // Delete from cache
  async del(store, key) {
    try {
      const cache = this.caches[store];
      if (!cache) {
        throw new Error(`Cache store ${store} not found`);
      }
      
      const deleted = cache.del(key);
      if (deleted > 0) {
        this.stats.deletes++;
        logger.debug(`Cache delete: ${store}:${key}`);
      }
      return deleted;
    } catch (error) {
      logger.error(`Cache delete error: ${error.message}`);
      return 0;
    }
  }

  // Clear specific cache store
  flush(store) {
    try {
      const cache = this.caches[store];
      if (!cache) {
        throw new Error(`Cache store ${store} not found`);
      }
      
      cache.flushAll();
      logger.info(`Cache flushed: ${store}`);
      return true;
    } catch (error) {
      logger.error(`Cache flush error: ${error.message}`);
      return false;
    }
  }

  // Clear all caches
  flushAll() {
    Object.values(this.caches).forEach(cache => cache.flushAll());
    logger.info('All caches flushed');
  }

  // Get cache statistics
  getStats() {
    const cacheStats = {};
    Object.entries(this.caches).forEach(([name, cache]) => {
      cacheStats[name] = {
        keys: cache.keys().length,
        ...cache.getStats()
      };
    });
    
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      stores: cacheStats
    };
  }

  // Cache middleware for Express routes
  middleware(store = 'api', ttl) {
    return async (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }
      
      // Generate cache key
      const key = this.generateKey(req.originalUrl, {
        query: req.query,
        user: req.user?.id
      });
      
      // Try to get from cache
      const cached = await this.get(store, key);
      if (cached) {
        return res.json(cached);
      }
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Cache successful responses only
        if (res.statusCode < 400) {
          cacheService.set(store, key, data, ttl);
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      next();
    };
  }

  // Invalidate related cache entries
  invalidatePattern(store, pattern) {
    try {
      const cache = this.caches[store];
      if (!cache) {
        throw new Error(`Cache store ${store} not found`);
      }
      
      const keys = cache.keys();
      const regex = new RegExp(pattern);
      let deletedCount = 0;
      
      keys.forEach(key => {
        if (regex.test(key)) {
          cache.del(key);
          deletedCount++;
        }
      });
      
      logger.info(`Invalidated ${deletedCount} cache entries matching ${pattern}`);
      return deletedCount;
    } catch (error) {
      logger.error(`Cache invalidation error: ${error.message}`);
      return 0;
    }
  }

  // Warm up cache with frequently accessed data
  async warmUp() {
    try {
      logger.info('Warming up cache...');
      
      // Add logic to pre-populate cache with frequently accessed data
      // For example, load common appointment slots, user preferences, etc.
      
      logger.info('Cache warm-up completed');
    } catch (error) {
      logger.error(`Cache warm-up error: ${error.message}`);
    }
  }

  // Cache decorator for class methods
  cached(store = 'api', ttl, keyGenerator) {
    return (target, propertyName, descriptor) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function(...args) {
        // Generate cache key
        const key = keyGenerator 
          ? keyGenerator(...args)
          : this.generateKey(`${target.constructor.name}:${propertyName}`, args);
        
        // Try to get from cache
        const cached = await this.get(store, key);
        if (cached !== null) {
          return cached;
        }
        
        // Execute original method
        const result = await originalMethod.apply(this, args);
        
        // Cache the result
        await this.set(store, key, result, ttl);
        
        return result;
      }.bind(this);
      
      return descriptor;
    };
  }
}

// Create singleton instance
const cacheService = new CacheService();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, flushing caches...');
  cacheService.flushAll();
});

export default cacheService;