import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger.js';
import monitoringService from '../services/monitoringService.js';

class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.connectionPool = null;
    this.mongoClient = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.reconnectInterval = 5000;
    
    // Connection pool configuration
    this.poolConfig = {
      minPoolSize: 10,
      maxPoolSize: 50,
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    };
    
    // Query optimization settings
    this.queryConfig = {
      lean: true, // Return plain JS objects
      maxTimeMS: 10000, // Max query execution time
      readPreference: 'secondaryPreferred',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority', j: true, wtimeout: 5000 }
    };
    
    // Performance monitoring
    this.queryStats = new Map();
    this.slowQueryThreshold = 1000; // ms
    
    this.setupEventHandlers();
  }

  // Enhanced connection with retry logic
  async connect() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dental-ai';
    
    try {
      // Configure mongoose connection
      mongoose.set('strictQuery', false);
      mongoose.set('debug', process.env.NODE_ENV === 'development');
      
      // Connection options
      const options = {
        ...this.poolConfig,
        autoIndex: process.env.NODE_ENV !== 'production',
        bufferCommands: false,
        // Retry logic
        retryWrites: true,
        retryReads: true
      };
      
      // Create MongoDB client for advanced operations
      this.mongoClient = new MongoClient(uri, options);
      await this.mongoClient.connect();
      
      // Connect mongoose
      await mongoose.connect(uri, options);
      
      this.isConnected = true;
      this.retryCount = 0;
      
      logger.info('Database connected successfully with connection pooling');
      
      // Initialize indexes and optimization
      await this.optimizeDatabase();
      
      // Start monitoring
      this.startPerformanceMonitoring();
      
      return true;
    } catch (error) {
      logger.error('Database connection error:', error);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(`Retrying database connection (${this.retryCount}/${this.maxRetries})...`);
        
        await new Promise(resolve => setTimeout(resolve, this.reconnectInterval));
        return this.connect();
      }
      
      throw new Error('Failed to connect to database after maximum retries');
    }
  }

  // Setup event handlers for connection monitoring
  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
      this.isConnected = true;
    });
    
    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
      monitoringService.trackError(err, { service: 'database' });
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
      this.isConnected = false;
      
      // Attempt reconnection
      if (process.env.NODE_ENV === 'production') {
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    });
    
    // Monitor slow queries
    mongoose.set('debug', (collectionName, method, query, doc, options) => {
      const key = `${collectionName}.${method}`;
      const startTime = Date.now();
      
      process.nextTick(() => {
        const duration = Date.now() - startTime;
        
        // Track query stats
        if (!this.queryStats.has(key)) {
          this.queryStats.set(key, {
            count: 0,
            totalTime: 0,
            avgTime: 0,
            maxTime: 0
          });
        }
        
        const stats = this.queryStats.get(key);
        stats.count++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;
        stats.maxTime = Math.max(stats.maxTime, duration);
        
        // Log slow queries
        if (duration > this.slowQueryThreshold) {
          logger.warn('Slow query detected:', {
            collection: collectionName,
            method,
            duration,
            query: JSON.stringify(query).substring(0, 200)
          });
          
          // Add to monitoring
          monitoringService.trackError(new Error('Slow query'), {
            collection: collectionName,
            method,
            duration,
            query
          });
        }
      });
    });
  }

  // Optimize database performance
  async optimizeDatabase() {
    try {
      const db = mongoose.connection.db;
      const admin = db.admin();
      
      // Get all collections
      const collections = await db.listCollections().toArray();
      
      for (const collection of collections) {
        const col = db.collection(collection.name);
        
        // Update collection options for better performance
        await col.options({
          capped: false,
          validationLevel: 'moderate',
          validationAction: 'warn'
        });
        
        // Get collection stats
        const stats = await col.stats();
        
        // Suggest optimizations based on stats
        if (stats.size > 100 * 1024 * 1024) { // > 100MB
          logger.info(`Large collection detected: ${collection.name} (${stats.size} bytes)`);
          
          // Consider sharding for very large collections
          if (stats.size > 1024 * 1024 * 1024) { // > 1GB
            logger.warn(`Collection ${collection.name} should be considered for sharding`);
          }
        }
        
        // Check index usage
        const indexStats = await col.aggregate([
          { $indexStats: {} }
        ]).toArray();
        
        for (const index of indexStats) {
          if (index.accesses.ops === 0) {
            logger.warn(`Unused index found: ${collection.name}.${index.name}`);
          }
        }
      }
      
      // Run database profiler in development
      if (process.env.NODE_ENV === 'development') {
        await db.setProfilingLevel(1, { slowms: 100 });
        logger.info('Database profiler enabled for slow queries > 100ms');
      }
      
      logger.info('Database optimization completed');
    } catch (error) {
      logger.error('Error optimizing database:', error);
    }
  }

  // Create optimized query builder
  createQueryBuilder(model) {
    return {
      find: (conditions = {}, options = {}) => {
        const query = model.find(conditions);
        
        // Apply default optimizations
        if (options.lean !== false) query.lean();
        if (options.select) query.select(options.select);
        if (options.populate) query.populate(options.populate);
        if (options.sort) query.sort(options.sort);
        if (options.limit) query.limit(options.limit);
        if (options.skip) query.skip(options.skip);
        
        // Add query hints for better performance
        if (options.hint) query.hint(options.hint);
        
        // Set max execution time
        query.maxTimeMS(options.maxTimeMS || this.queryConfig.maxTimeMS);
        
        return query;
      },
      
      findOne: (conditions = {}, options = {}) => {
        const query = model.findOne(conditions);
        
        if (options.lean !== false) query.lean();
        if (options.select) query.select(options.select);
        if (options.populate) query.populate(options.populate);
        
        query.maxTimeMS(options.maxTimeMS || this.queryConfig.maxTimeMS);
        
        return query;
      },
      
      aggregate: (pipeline = [], options = {}) => {
        const aggregation = model.aggregate(pipeline);
        
        // Add performance options
        aggregation.allowDiskUse(true);
        aggregation.option({ 
          maxTimeMS: options.maxTimeMS || this.queryConfig.maxTimeMS,
          readPreference: options.readPreference || this.queryConfig.readPreference
        });
        
        // Add cursor for large result sets
        if (options.cursor) {
          aggregation.cursor({ batchSize: options.batchSize || 100 });
        }
        
        return aggregation;
      },
      
      bulkWrite: async (operations, options = {}) => {
        // Batch operations for better performance
        const batchSize = options.batchSize || 1000;
        const results = [];
        
        for (let i = 0; i < operations.length; i += batchSize) {
          const batch = operations.slice(i, i + batchSize);
          const result = await model.bulkWrite(batch, {
            ordered: false,
            ...options
          });
          results.push(result);
        }
        
        return results;
      },
      
      // Optimized count
      countDocuments: async (conditions = {}, options = {}) => {
        // Use estimatedDocumentCount for better performance when possible
        if (Object.keys(conditions).length === 0 && !options.accurate) {
          return await model.estimatedDocumentCount();
        }
        
        return await model.countDocuments(conditions)
          .maxTimeMS(options.maxTimeMS || this.queryConfig.maxTimeMS);
      },
      
      // Parallel query execution
      parallel: async (queries) => {
        const results = await Promise.all(queries.map(q => q.exec()));
        return results;
      },
      
      // Query with caching
      cached: async (query, cacheKey, ttl = 300) => {
        const cached = await cacheService.get('db', cacheKey);
        if (cached) return cached;
        
        const result = await query.exec();
        await cacheService.set('db', cacheKey, result, ttl);
        
        return result;
      }
    };
  }

  // Transaction support
  async executeTransaction(operations) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const results = [];
      
      for (const operation of operations) {
        const result = await operation(session);
        results.push(result);
      }
      
      await session.commitTransaction();
      logger.info('Transaction committed successfully');
      
      return results;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Transaction aborted:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Batch operations for better performance
  async batchInsert(model, documents, options = {}) {
    const batchSize = options.batchSize || 1000;
    const results = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      try {
        const inserted = await model.insertMany(batch, {
          ordered: false,
          rawResult: true,
          ...options
        });
        results.push(inserted);
      } catch (error) {
        logger.error(`Batch insert error at index ${i}:`, error);
        if (!options.continueOnError) throw error;
      }
    }
    
    return results;
  }

  // Performance monitoring
  startPerformanceMonitoring() {
    setInterval(() => {
      const stats = this.getPerformanceStats();
      
      if (stats.slowQueries.length > 0) {
        logger.warn('Slow queries detected:', stats.slowQueries);
      }
      
      // Report to monitoring service
      monitoringService.emit('metrics', {
        database: stats
      });
    }, 60000); // Every minute
  }

  // Get performance statistics
  getPerformanceStats() {
    const stats = {
      connectionPool: {
        active: mongoose.connection.readyState,
        poolSize: this.poolConfig.maxPoolSize
      },
      queries: {},
      slowQueries: []
    };
    
    // Aggregate query stats
    for (const [key, value] of this.queryStats.entries()) {
      stats.queries[key] = value;
      
      if (value.avgTime > this.slowQueryThreshold) {
        stats.slowQueries.push({
          query: key,
          avgTime: value.avgTime,
          count: value.count
        });
      }
    }
    
    return stats;
  }

  // Clean up and close connections
  async disconnect() {
    try {
      if (this.mongoClient) {
        await this.mongoClient.close();
      }
      
      await mongoose.disconnect();
      this.isConnected = false;
      
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }
      
      // Ping database
      await mongoose.connection.db.admin().ping();
      
      // Check connection pool
      const serverStatus = await mongoose.connection.db.admin().serverStatus();
      
      return {
        status: 'healthy',
        connected: true,
        connections: serverStatus.connections,
        uptime: serverStatus.uptime,
        version: serverStatus.version
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing database connections...');
  await databaseManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing database connections...');
  await databaseManager.disconnect();
  process.exit(0);
});

export default databaseManager;