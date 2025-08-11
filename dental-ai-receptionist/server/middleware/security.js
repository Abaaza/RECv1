import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';
import AuditLog from '../models/AuditLog.js';

// Content Security Policy configuration
export const contentSecurityPolicy = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://api.openai.com', 'https://api.deepgram.com'],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
  }
});

// CORS configuration
export const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://dental-ai-receptionist.com'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400 // 24 hours
};

// Rate limiting configurations
export const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded: ${req.ip} - ${req.path}`);
      res.status(429).json({ error: message });
    }
  });
};

// Different rate limiters for different endpoints
export const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many requests, please try again later.'
);

export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts, please try again later.'
);

export const aiLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10, // limit each IP to 10 AI requests per minute
  'Too many AI requests, please slow down.'
);

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Recursive object sanitization
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Sanitize the key
      const sanitizedKey = sanitizeValue(key);
      // Sanitize the value
      sanitized[sanitizedKey] = sanitizeObject(obj[key]);
    }
  }
  
  return sanitized;
}

// Sanitize individual values
function sanitizeValue(value) {
  if (typeof value === 'string') {
    // Remove any script tags
    value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove any SQL injection attempts
    value = value.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi, '');
    // Remove any NoSQL injection attempts
    value = value.replace(/(\$ne|\$eq|\$gt|\$gte|\$lt|\$lte|\$in|\$nin|\$and|\$or|\$not|\$nor)/gi, '');
    // Trim whitespace
    value = value.trim();
  }
  
  return value;
}

// Audit logging middleware
export const auditLog = (action, entityType) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    const originalStatus = res.status;
    let statusCode = 200;
    let responseData = null;
    
    // Capture status code
    res.status = function(code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };
    
    // Capture response data
    res.json = async function(data) {
      responseData = data;
      
      // Log the audit entry
      try {
        const auditEntry = {
          userId: req.user?.id || 'anonymous',
          userEmail: req.user?.email,
          userRole: req.user?.role,
          action,
          entityType,
          entityId: data?.id || data?._id || req.params?.id,
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.method !== 'GET' ? req.body : undefined,
          statusCode,
          success: statusCode < 400,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          timestamp: new Date()
        };
        
        // Save to database asynchronously
        AuditLog.create(auditEntry).catch(err => {
          logger.error('Failed to create audit log:', err);
        });
        
        // Log sensitive operations
        if (isSensitiveOperation(action)) {
          logger.warn('Sensitive operation performed:', {
            user: req.user?.email,
            action,
            entityType,
            ip: req.ip
          });
        }
      } catch (error) {
        logger.error('Audit logging error:', error);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Check if operation is sensitive
function isSensitiveOperation(action) {
  const sensitiveActions = [
    'DELETE',
    'UPDATE_ROLE',
    'CHANGE_PASSWORD',
    'ACCESS_PATIENT_DATA',
    'EXPORT_DATA',
    'MODIFY_SETTINGS',
    'PROCESS_PAYMENT'
  ];
  
  return sensitiveActions.includes(action);
}

// Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

// SQL injection prevention
export const preventSQLInjection = (req, res, next) => {
  const suspicious = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|SCRIPT)\b)/gi;
  
  const checkValue = (value) => {
    if (typeof value === 'string' && suspicious.test(value)) {
      logger.warn(`Potential SQL injection attempt from ${req.ip}: ${value}`);
      return true;
    }
    return false;
  };
  
  const checkObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          if (checkObject(value)) return true;
        } else if (checkValue(value)) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (
    (req.body && checkObject(req.body)) ||
    (req.query && checkObject(req.query)) ||
    (req.params && checkObject(req.params))
  ) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }
  
  next();
};

// API key validation for external services
export const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Validate API key (implement your logic here)
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn(`Invalid API key attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Session security
export const sessionSecurity = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  }
};

// Export all security middleware as a single function
export const setupSecurity = (app) => {
  // Basic security headers
  app.use(helmet());
  app.use(contentSecurityPolicy);
  
  // CORS
  app.use(cors(corsOptions));
  
  // Body parsing security
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // NoSQL injection prevention
  app.use(mongoSanitize());
  
  // XSS prevention
  app.use(xss());
  
  // HTTP Parameter Pollution prevention
  app.use(hpp());
  
  // Custom security middleware
  app.use(securityHeaders);
  app.use(sanitizeInput);
  app.use(preventSQLInjection);
  
  // Rate limiting
  app.use('/api/', generalLimiter);
  app.use('/api/auth/', authLimiter);
  app.use('/api/ai/', aiLimiter);
  
  logger.info('Security middleware configured');
};

export default {
  setupSecurity,
  auditLog,
  validateApiKey,
  sessionSecurity,
  corsOptions,
  generalLimiter,
  authLimiter,
  aiLimiter
};