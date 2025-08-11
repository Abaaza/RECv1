import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Error statistics
const errorStats = {
  frontend: {},
  backend: {},
  lastReset: Date.now()
};

// Reset stats every 24 hours
setInterval(() => {
  errorStats.frontend = {};
  errorStats.backend = {};
  errorStats.lastReset = Date.now();
}, 24 * 60 * 60 * 1000);

// Log frontend errors
router.post('/log', async (req, res) => {
  try {
    const {
      message,
      stack,
      componentStack,
      type,
      errorType,
      timestamp,
      userAgent,
      url,
      sessionId,
      browserInfo,
      requestId
    } = req.body;

    // Log the error
    logger.error('Frontend Error:', {
      source: 'frontend',
      message,
      stack,
      componentStack,
      type: type || errorType,
      timestamp,
      userAgent,
      url,
      sessionId,
      browserInfo,
      requestId,
      user: req.user?.id,
      ip: req.ip
    });

    // Track error statistics
    const errorKey = type || errorType || 'unknown';
    if (!errorStats.frontend[errorKey]) {
      errorStats.frontend[errorKey] = 0;
    }
    errorStats.frontend[errorKey]++;

    // Alert if error rate is high
    if (errorStats.frontend[errorKey] > 50) {
      logger.error(`High frontend error rate for ${errorKey}: ${errorStats.frontend[errorKey]} errors`);
    }

    res.status(200).json({
      success: true,
      message: 'Error logged successfully',
      errorId: Date.now().toString(36)
    });
  } catch (error) {
    logger.error('Failed to log frontend error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log error'
    });
  }
});

// Get error statistics (admin only)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const uptime = Date.now() - errorStats.lastReset;
    const hours = Math.floor(uptime / (1000 * 60 * 60));

    res.json({
      success: true,
      stats: {
        frontend: errorStats.frontend,
        backend: errorStats.backend,
        uptimeHours: hours,
        lastReset: new Date(errorStats.lastReset).toISOString(),
        totalFrontendErrors: Object.values(errorStats.frontend).reduce((a, b) => a + b, 0),
        totalBackendErrors: Object.values(errorStats.backend).reduce((a, b) => a + b, 0)
      }
    });
  } catch (error) {
    logger.error('Failed to get error stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve error statistics'
    });
  }
});

// Clear error logs (admin only)
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    errorStats.frontend = {};
    errorStats.backend = {};
    errorStats.lastReset = Date.now();

    logger.info('Error statistics cleared by admin:', req.user.id);

    res.json({
      success: true,
      message: 'Error statistics cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear error stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear error statistics'
    });
  }
});

// Test error endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/test/:type', (req, res, next) => {
    const { type } = req.params;
    
    switch (type) {
      case 'validation':
        const validationError = new Error('Test validation error');
        validationError.name = 'ValidationError';
        validationError.statusCode = 400;
        throw validationError;
        
      case 'auth':
        const authError = new Error('Test authentication error');
        authError.name = 'AuthenticationError';
        authError.statusCode = 401;
        throw authError;
        
      case 'notfound':
        const notFoundError = new Error('Test resource not found');
        notFoundError.name = 'NotFoundError';
        notFoundError.statusCode = 404;
        throw notFoundError;
        
      case 'server':
        const serverError = new Error('Test server error');
        serverError.statusCode = 500;
        throw serverError;
        
      case 'database':
        const dbError = new Error('Test database error');
        dbError.name = 'DatabaseError';
        dbError.statusCode = 500;
        throw dbError;
        
      case 'timeout':
        // Simulate timeout
        setTimeout(() => {
          res.json({ message: 'This should timeout' });
        }, 30000);
        break;
        
      default:
        res.json({ 
          message: 'Test error endpoint',
          availableTypes: ['validation', 'auth', 'notfound', 'server', 'database', 'timeout']
        });
    }
  });
}

// Track backend errors
export const trackBackendError = (errorType) => {
  if (!errorStats.backend[errorType]) {
    errorStats.backend[errorType] = 0;
  }
  errorStats.backend[errorType]++;
};

export default router;