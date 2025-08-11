// Centralized error handling utilities for the frontend

class ErrorHandler {
  constructor() {
    this.retryQueue = new Map();
    this.errorListeners = new Set();
    this.isOnline = navigator.onLine;
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  // Register error listener
  addErrorListener(listener) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  // Notify all listeners
  notifyListeners(error) {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  // Classify error type
  classifyError(error) {
    if (!error) return 'unknown';
    
    const message = error.message?.toLowerCase() || '';
    const code = error.code || error.status || error.statusCode;
    
    // Network errors
    if (!this.isOnline || message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    
    // Timeout errors
    if (message.includes('timeout') || code === 408) {
      return 'timeout';
    }
    
    // Authentication errors
    if (code === 401 || message.includes('unauthorized') || message.includes('token')) {
      return 'auth';
    }
    
    // Permission errors
    if (code === 403 || message.includes('forbidden') || message.includes('permission')) {
      return 'permission';
    }
    
    // Not found errors
    if (code === 404 || message.includes('not found')) {
      return 'not_found';
    }
    
    // Validation errors
    if (code === 400 || message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    
    // Rate limit errors
    if (code === 429 || message.includes('rate limit') || message.includes('too many')) {
      return 'rate_limit';
    }
    
    // Server errors
    if (code >= 500 || message.includes('server')) {
      return 'server';
    }
    
    return 'unknown';
  }

  // Get user-friendly error message
  getUserMessage(error, errorType) {
    const defaultMessages = {
      network: 'Unable to connect. Please check your internet connection.',
      timeout: 'The request took too long. Please try again.',
      auth: 'Please log in to continue.',
      permission: 'You don\'t have permission to access this resource.',
      not_found: 'The requested resource was not found.',
      validation: 'Please check your input and try again.',
      rate_limit: 'Too many requests. Please wait a moment and try again.',
      server: 'Something went wrong on our end. Please try again later.',
      unknown: 'An unexpected error occurred. Please try again.'
    };
    
    // Use custom message if provided
    if (error.userMessage) {
      return error.userMessage;
    }
    
    // Use API message if it's user-friendly
    if (error.message && !error.message.includes('fetch') && !error.message.includes('Failed')) {
      return error.message;
    }
    
    return defaultMessages[errorType] || defaultMessages.unknown;
  }

  // Handle API errors
  async handleApiError(error, request = {}) {
    const errorType = this.classifyError(error);
    const enhancedError = {
      ...error,
      type: errorType,
      timestamp: new Date().toISOString(),
      request,
      userMessage: this.getUserMessage(error, errorType)
    };
    
    // Log error
    this.logError(enhancedError);
    
    // Notify listeners
    this.notifyListeners(enhancedError);
    
    // Handle specific error types
    switch (errorType) {
      case 'network':
        if (request.retry !== false) {
          this.addToRetryQueue(request, error);
        }
        break;
        
      case 'auth':
        // Clear auth token and redirect to login
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        break;
        
      case 'timeout':
        if (request.retry !== false && (!request.retryCount || request.retryCount < 3)) {
          return this.retryRequest(request);
        }
        break;
        
      case 'rate_limit':
        // Show rate limit warning
        this.showRateLimitWarning(error);
        break;
    }
    
    throw enhancedError;
  }

  // Retry failed request
  async retryRequest(request, delay = 1000) {
    const retryCount = (request.retryCount || 0) + 1;
    
    if (retryCount > 3) {
      throw new Error('Maximum retry attempts reached');
    }
    
    await new Promise(resolve => setTimeout(resolve, delay * retryCount));
    
    return fetch(request.url, {
      ...request,
      retryCount
    });
  }

  // Add request to retry queue
  addToRetryQueue(request, error) {
    if (!this.retryQueue.has(request.url)) {
      this.retryQueue.set(request.url, {
        request,
        error,
        attempts: 0,
        timestamp: Date.now()
      });
    }
  }

  // Process retry queue when back online
  async processRetryQueue() {
    if (!this.isOnline || this.retryQueue.size === 0) return;
    
    const queue = Array.from(this.retryQueue.entries());
    this.retryQueue.clear();
    
    for (const [url, item] of queue) {
      if (Date.now() - item.timestamp > 300000) { // Skip if older than 5 minutes
        continue;
      }
      
      try {
        await this.retryRequest(item.request, 0);
        console.log(`Successfully retried request to ${url}`);
      } catch (error) {
        console.error(`Failed to retry request to ${url}:`, error);
        
        if (item.attempts < 3) {
          item.attempts++;
          this.retryQueue.set(url, item);
        }
      }
    }
  }

  // Handle online event
  handleOnline() {
    this.isOnline = true;
    console.log('Connection restored');
    this.processRetryQueue();
  }

  // Handle offline event
  handleOffline() {
    this.isOnline = false;
    console.log('Connection lost');
  }

  // Show rate limit warning
  showRateLimitWarning(error) {
    const retryAfter = error.headers?.get('Retry-After') || 60;
    console.warn(`Rate limited. Retry after ${retryAfter} seconds`);
  }

  // Log error for debugging
  logError(error) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error:', error);
    }
    
    // Store in localStorage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      errors.push({
        ...error,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 20 errors
      if (errors.length > 20) {
        errors.splice(0, errors.length - 20);
      }
      
      localStorage.setItem('app_errors', JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to log error to localStorage:', e);
    }
    
    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(error);
    }
  }

  // Send error to monitoring service
  async sendToMonitoring(error) {
    try {
      await fetch('/api/errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...error,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('Failed to send error to monitoring:', e);
    }
  }

  // Clear error logs
  clearErrors() {
    localStorage.removeItem('app_errors');
    this.retryQueue.clear();
  }

  // Get stored errors for debugging
  getStoredErrors() {
    try {
      return JSON.parse(localStorage.getItem('app_errors') || '[]');
    } catch {
      return [];
    }
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Enhanced fetch with error handling
export const fetchWithErrorHandling = async (url, options = {}) => {
  const request = {
    url,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, request);
    
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.statusText = response.statusText;
      
      try {
        const data = await response.json();
        error.message = data.message || error.message;
        error.errors = data.errors;
      } catch {
        // Response wasn't JSON
      }
      
      throw error;
    }
    
    return response;
  } catch (error) {
    return errorHandler.handleApiError(error, request);
  }
};

// React hook for error handling
export const useErrorHandler = () => {
  const [errors, setErrors] = React.useState([]);
  
  React.useEffect(() => {
    const unsubscribe = errorHandler.addErrorListener((error) => {
      setErrors(prev => [...prev, error]);
    });
    
    return unsubscribe;
  }, []);
  
  const clearErrors = () => setErrors([]);
  
  return { errors, clearErrors };
};

export default errorHandler;