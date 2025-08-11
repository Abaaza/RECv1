import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service, originalError) {
    super(`External service error: ${service}`, 503);
    this.name = 'ExternalServiceError';
    this.service = service;
    this.originalError = originalError;
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network request failed') {
    super(message, 503);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends AppError {
  constructor(message = 'Request timeout') {
    super(message, 408);
    this.name = 'TimeoutError';
  }
}

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new ValidationError(message);
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyPattern)[0];
  const message = `${field} already exists. Please use another value!`;
  return new ConflictError(message);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message
  }));
  const message = 'Invalid input data';
  return new ValidationError(message, errors);
};

const handleJWTError = () => 
  new AuthenticationError('Invalid token. Please log in again!');

const handleJWTExpiredError = () => 
  new AuthenticationError('Your token has expired! Please log in again.');

// Error recovery strategies
const errorRecoveryStrategies = {
  'DatabaseError': async () => {
    // Try to reconnect to database
    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Database reconnected after error');
      } catch (reconnectError) {
        logger.error('Failed to reconnect to database:', reconnectError);
      }
    }
  },
  'NetworkError': () => {
    // Clear any cached network requests
    logger.info('Network error detected, clearing cache');
  },
  'TimeoutError': () => {
    // Log timeout for monitoring
    logger.warn('Request timeout detected');
  }
};

// Error statistics tracking
const errorStats = {
  counts: {},
  lastReset: Date.now()
};

const trackError = (errorType) => {
  if (!errorStats.counts[errorType]) {
    errorStats.counts[errorType] = 0;
  }
  errorStats.counts[errorType]++;
  
  // Reset stats every hour
  if (Date.now() - errorStats.lastReset > 3600000) {
    errorStats.counts = {};
    errorStats.lastReset = Date.now();
  }
  
  // Alert if too many errors of same type
  if (errorStats.counts[errorType] > 10) {
    logger.error(`High error rate detected for ${errorType}: ${errorStats.counts[errorType]} errors`);
  }
};

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Enhanced error logging
  const errorLog = {
    error: {
      name: err.name,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      user: req.user?.id,
      requestId: req.id || Date.now().toString(36),
      timestamp: new Date().toISOString(),
      body: process.env.NODE_ENV === 'development' ? req.body : undefined,
      query: req.query,
      params: req.params
    }
  };
  
  logger.error(errorLog);
  
  // Track error statistics
  trackError(err.name || 'UnknownError');
  
  // Apply recovery strategy if available
  const recoveryStrategy = errorRecoveryStrategies[err.name];
  if (recoveryStrategy) {
    recoveryStrategy().catch(e => logger.error('Recovery strategy failed:', e));
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') error = handleCastErrorDB(err);
  
  // Mongoose duplicate key
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  
  // UnauthorizedError (from express-jwt or similar)
  if (err.name === 'UnauthorizedError') {
    error = new AuthorizationError('Unauthorized access');
  }

  // Set default error values
  error.statusCode = error.statusCode || err.status || 500;
  error.status = error.status || 'error';

  // Prepare error response
  const errorResponse = {
    status: error.status,
    message: error.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.id || Date.now().toString(36)
  };

  // Add additional fields based on error type
  if (error.errors) {
    errorResponse.errors = error.errors;
  }
  
  if (error.name === 'ValidationError') {
    errorResponse.type = 'validation';
  } else if (error.name === 'AuthenticationError' || error.name === 'AuthorizationError') {
    errorResponse.type = 'auth';
  } else if (error.name === 'NotFoundError') {
    errorResponse.type = 'not_found';
  } else if (error.statusCode >= 500) {
    errorResponse.type = 'server';
  } else {
    errorResponse.type = 'client';
  }

  // Send error response
  if (process.env.NODE_ENV === 'production') {
    // Production: send minimal error info
    if (error.isOperational) {
      res.status(error.statusCode).json(errorResponse);
    } else {
      // Programming or unknown errors: don't leak details
      console.error('ERROR 💥', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
        type: 'server',
        requestId: errorResponse.requestId,
        timestamp: errorResponse.timestamp
      });
    }
  } else {
    // Development: send full error details
    res.status(error.statusCode).json({
      ...errorResponse,
      error: error,
      stack: error.stack,
      debug: {
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers
      }
    });
  }
};

export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Global error handlers with graceful shutdown
let server;

export const setServer = (serverInstance) => {
  server = serverInstance;
};

const gracefulShutdown = (errorType, error) => {
  logger.error(`${errorType}! 💥 Starting graceful shutdown...`);
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });
  
  if (server) {
    server.close(() => {
      logger.info('Server closed gracefully');
      process.exit(1);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(1);
  }
};

if (process.env.NODE_ENV === 'production') {
  process.on('uncaughtException', (err) => {
    gracefulShutdown('UNCAUGHT EXCEPTION', err);
  });

  process.on('unhandledRejection', (err) => {
    gracefulShutdown('UNHANDLED REJECTION', err);
  });
} else {
  // In development, log but don't exit
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION (Development):', err);
  });

  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION (Development):', err);
  });
}