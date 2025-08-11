import { EventEmitter } from 'events';
import { logger } from './logger.js';
import monitoringService from '../services/monitoringService.js';

// Circuit Breaker States
const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker extends EventEmitter {
  constructor(name, options = {}) {
    super();
    
    this.name = name;
    this.state = STATES.CLOSED;
    
    // Configuration
    this.config = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 2,
      timeout: options.timeout || 60000, // 1 minute
      resetTimeout: options.resetTimeout || 30000, // 30 seconds
      volumeThreshold: options.volumeThreshold || 10,
      errorThresholdPercentage: options.errorThresholdPercentage || 50,
      requestVolumeThreshold: options.requestVolumeThreshold || 20,
      sleepWindow: options.sleepWindow || 5000,
      ...options
    };
    
    // Statistics
    this.stats = {
      failures: 0,
      successes: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      totalRequests: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      stateChanges: []
    };
    
    // Request tracking for percentage-based thresholds
    this.requestWindow = [];
    this.windowSize = options.windowSize || 10000; // 10 seconds
    
    this.nextAttempt = Date.now();
    this.fallbackFunction = options.fallback;
    
    // Start monitoring
    this.startMonitoring();
  }

  // Execute function with circuit breaker protection
  async execute(fn, ...args) {
    // Check if circuit should be tested
    if (this.state === STATES.OPEN) {
      if (Date.now() < this.nextAttempt) {
        return this.handleOpen();
      }
      // Try half-open state
      this.transitionToHalfOpen();
    }
    
    try {
      // Track request
      this.trackRequest(true);
      
      // Execute with timeout
      const result = await this.executeWithTimeout(fn, ...args);
      
      // Handle success
      this.onSuccess();
      
      return result;
    } catch (error) {
      // Handle failure
      this.onFailure(error);
      
      // Check if we should use fallback
      if (this.fallbackFunction) {
        try {
          return await this.fallbackFunction(...args);
        } catch (fallbackError) {
          logger.error(`Fallback also failed for ${this.name}:`, fallbackError);
          throw error;
        }
      }
      
      throw error;
    }
  }

  // Execute with timeout protection
  async executeWithTimeout(fn, ...args) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Circuit breaker timeout for ${this.name}`));
      }, this.config.timeout);
      
      try {
        const result = await fn(...args);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  // Handle success
  onSuccess() {
    this.stats.successes++;
    this.stats.totalRequests++;
    this.stats.consecutiveSuccesses++;
    this.stats.consecutiveFailures = 0;
    this.stats.lastSuccessTime = Date.now();
    
    if (this.state === STATES.HALF_OPEN) {
      if (this.stats.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
    
    this.emit('success', {
      circuit: this.name,
      state: this.state
    });
  }

  // Handle failure
  onFailure(error) {
    this.stats.failures++;
    this.stats.totalRequests++;
    this.stats.consecutiveFailures++;
    this.stats.consecutiveSuccesses = 0;
    this.stats.lastFailureTime = Date.now();
    
    this.trackRequest(false);
    
    logger.warn(`Circuit breaker ${this.name} failure:`, {
      error: error.message,
      consecutiveFailures: this.stats.consecutiveFailures,
      state: this.state
    });
    
    // Check if we should open the circuit
    if (this.shouldOpen()) {
      this.transitionToOpen();
    }
    
    this.emit('failure', {
      circuit: this.name,
      state: this.state,
      error
    });
    
    // Report to monitoring
    monitoringService.trackError(error, {
      circuitBreaker: this.name,
      state: this.state
    });
  }

  // Check if circuit should open
  shouldOpen() {
    if (this.state === STATES.OPEN) return false;
    
    // Check consecutive failures
    if (this.stats.consecutiveFailures >= this.config.failureThreshold) {
      return true;
    }
    
    // Check error percentage
    const recentRequests = this.getRecentRequests();
    if (recentRequests.length >= this.config.requestVolumeThreshold) {
      const errorRate = this.calculateErrorRate(recentRequests);
      if (errorRate >= this.config.errorThresholdPercentage) {
        return true;
      }
    }
    
    return false;
  }

  // Track request for windowed metrics
  trackRequest(success) {
    const now = Date.now();
    this.requestWindow.push({
      timestamp: now,
      success
    });
    
    // Clean old entries
    this.requestWindow = this.requestWindow.filter(
      req => now - req.timestamp < this.windowSize
    );
  }

  // Get recent requests within window
  getRecentRequests() {
    const now = Date.now();
    return this.requestWindow.filter(
      req => now - req.timestamp < this.windowSize
    );
  }

  // Calculate error rate
  calculateErrorRate(requests) {
    if (requests.length === 0) return 0;
    
    const failures = requests.filter(req => !req.success).length;
    return (failures / requests.length) * 100;
  }

  // Handle open state
  handleOpen() {
    const error = new Error(`Circuit breaker ${this.name} is OPEN`);
    error.code = 'CIRCUIT_OPEN';
    error.circuit = this.name;
    error.nextAttempt = this.nextAttempt;
    
    this.emit('reject', {
      circuit: this.name,
      state: this.state
    });
    
    throw error;
  }

  // State transitions
  transitionToOpen() {
    this.state = STATES.OPEN;
    this.nextAttempt = Date.now() + this.config.resetTimeout;
    
    this.stats.stateChanges.push({
      from: this.state,
      to: STATES.OPEN,
      timestamp: Date.now(),
      reason: 'Failure threshold exceeded'
    });
    
    logger.error(`Circuit breaker ${this.name} opened`, {
      failures: this.stats.failures,
      consecutiveFailures: this.stats.consecutiveFailures
    });
    
    this.emit('open', {
      circuit: this.name,
      nextAttempt: this.nextAttempt
    });
  }

  transitionToHalfOpen() {
    this.state = STATES.HALF_OPEN;
    this.stats.consecutiveFailures = 0;
    this.stats.consecutiveSuccesses = 0;
    
    this.stats.stateChanges.push({
      from: STATES.OPEN,
      to: STATES.HALF_OPEN,
      timestamp: Date.now(),
      reason: 'Testing recovery'
    });
    
    logger.info(`Circuit breaker ${this.name} half-open`);
    
    this.emit('halfOpen', {
      circuit: this.name
    });
  }

  transitionToClosed() {
    this.state = STATES.CLOSED;
    this.stats.consecutiveFailures = 0;
    
    this.stats.stateChanges.push({
      from: this.state,
      to: STATES.CLOSED,
      timestamp: Date.now(),
      reason: 'Recovery successful'
    });
    
    logger.info(`Circuit breaker ${this.name} closed`);
    
    this.emit('close', {
      circuit: this.name
    });
  }

  // Force state change (for manual intervention)
  forceOpen() {
    this.transitionToOpen();
  }

  forceClosed() {
    this.state = STATES.CLOSED;
    this.stats.consecutiveFailures = 0;
    this.stats.consecutiveSuccesses = 0;
    this.emit('forceClosed', { circuit: this.name });
  }

  reset() {
    this.state = STATES.CLOSED;
    this.stats = {
      failures: 0,
      successes: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      totalRequests: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      stateChanges: []
    };
    this.requestWindow = [];
    this.emit('reset', { circuit: this.name });
  }

  // Get current stats
  getStats() {
    const recentRequests = this.getRecentRequests();
    
    return {
      name: this.name,
      state: this.state,
      stats: this.stats,
      errorRate: this.calculateErrorRate(recentRequests),
      requestsInWindow: recentRequests.length,
      nextAttempt: this.state === STATES.OPEN ? this.nextAttempt : null
    };
  }

  // Start monitoring
  startMonitoring() {
    setInterval(() => {
      const stats = this.getStats();
      
      // Report to monitoring service
      if (this.state === STATES.OPEN) {
        monitoringService.emit('alert', {
          type: 'CIRCUIT_BREAKER_OPEN',
          circuit: this.name,
          stats
        });
      }
    }, 30000); // Every 30 seconds
  }
}

// Retry mechanism with exponential backoff
class RetryManager {
  constructor(options = {}) {
    this.config = {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      backoffMultiplier: options.backoffMultiplier || 2,
      jitter: options.jitter !== false,
      retryableErrors: options.retryableErrors || [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN'
      ]
    };
  }

  // Execute with retry logic
  async executeWithRetry(fn, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Log retry attempt
        if (attempt > 1) {
          logger.info(`Retry attempt ${attempt}/${this.config.maxRetries} for ${context.operation || 'operation'}`);
        }
        
        // Execute function
        const result = await fn();
        
        // Success - log if it was a retry
        if (attempt > 1) {
          logger.info(`Retry successful on attempt ${attempt} for ${context.operation || 'operation'}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error;
        }
        
        // Check if we have more retries
        if (attempt === this.config.maxRetries) {
          logger.error(`All retry attempts failed for ${context.operation || 'operation'}`, {
            attempts: attempt,
            error: error.message
          });
          throw error;
        }
        
        // Calculate delay
        const delay = this.calculateDelay(attempt);
        
        logger.warn(`Retry attempt ${attempt} failed for ${context.operation || 'operation'}, retrying in ${delay}ms`, {
          error: error.message,
          nextAttempt: attempt + 1
        });
        
        // Wait before retry
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  // Check if error is retryable
  isRetryable(error) {
    // Check error codes
    if (this.config.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check HTTP status codes
    if (error.response) {
      const status = error.response.status;
      // Retry on 5xx errors and specific 4xx errors
      return status >= 500 || status === 429 || status === 408;
    }
    
    // Check specific error messages
    const retryableMessages = [
      'ECONNRESET',
      'socket hang up',
      'EHOSTUNREACH',
      'EAI_AGAIN',
      'ECONNABORTED'
    ];
    
    return retryableMessages.some(msg => 
      error.message && error.message.includes(msg)
    );
  }

  // Calculate delay with exponential backoff
  calculateDelay(attempt) {
    // Exponential backoff
    let delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      const jitter = Math.random() * delay * 0.1; // 10% jitter
      delay = delay + jitter;
    }
    
    return Math.floor(delay);
  }

  // Delay helper
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Circuit breaker factory
class CircuitBreakerFactory {
  constructor() {
    this.breakers = new Map();
    this.defaultConfig = {
      failureThreshold: 5,
      resetTimeout: 30000,
      timeout: 10000
    };
  }

  // Get or create circuit breaker
  getBreaker(name, config = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(name, {
        ...this.defaultConfig,
        ...config
      });
      this.breakers.set(name, breaker);
    }
    
    return this.breakers.get(name);
  }

  // Get all breakers
  getAllBreakers() {
    return Array.from(this.breakers.values());
  }

  // Get stats for all breakers
  getAllStats() {
    return this.getAllBreakers().map(breaker => breaker.getStats());
  }

  // Reset all breakers
  resetAll() {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// Create singletons
const circuitBreakerFactory = new CircuitBreakerFactory();
const retryManager = new RetryManager();

// Decorator for adding circuit breaker to functions
export function withCircuitBreaker(name, config = {}) {
  const breaker = circuitBreakerFactory.getBreaker(name, config);
  
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      return await breaker.execute(originalMethod.bind(this), ...args);
    };
    
    return descriptor;
  };
}

// Decorator for adding retry logic to functions
export function withRetry(options = {}) {
  const retry = new RetryManager(options);
  
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      return await retry.executeWithRetry(
        () => originalMethod.apply(this, args),
        { operation: `${target.constructor.name}.${propertyKey}` }
      );
    };
    
    return descriptor;
  };
}

export {
  CircuitBreaker,
  RetryManager,
  circuitBreakerFactory,
  retryManager,
  STATES
};