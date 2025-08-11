import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createHash, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { logger } from '../utils/logger.js';
import AuditLog from '../models/AuditLog.js';
import monitoringService from '../services/monitoringService.js';

const scryptAsync = promisify(scrypt);

// OWASP Security Headers
export const securityHeaders = (req, res, next) => {
  // OWASP recommended headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.openai.com https://api.deepgram.com wss://; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(self), geolocation=(), payment=()'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Remove potentially dangerous headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

// Advanced Rate Limiting with Redis
class AdvancedRateLimiter {
  constructor() {
    this.limiters = new Map();
    this.redis = null; // Redis client would be initialized here
    
    // Default configurations for different endpoint types
    this.configs = {
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 requests per window
        message: 'Too many authentication attempts, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        keyGenerator: this.authKeyGenerator
      },
      api: {
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
        message: 'Too many requests, please slow down',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: this.defaultKeyGenerator
      },
      ai: {
        windowMs: 60 * 1000, // 1 minute
        max: 10, // 10 AI requests per minute
        message: 'AI rate limit exceeded, please wait',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: this.defaultKeyGenerator,
        skip: this.skipSuccessfulAIRequests
      },
      payment: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 20, // 20 payment requests per hour
        message: 'Payment rate limit exceeded',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: this.userKeyGenerator
      },
      upload: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 uploads per hour
        message: 'Upload limit exceeded',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: this.userKeyGenerator
      }
    };
  }

  // Create rate limiter for specific endpoint
  createLimiter(type, customConfig = {}) {
    const config = { ...this.configs[type], ...customConfig };
    
    // Use Redis store if available for distributed rate limiting
    if (this.redis) {
      config.store = new RedisStore({
        client: this.redis,
        prefix: `rl:${type}:`
      });
    }
    
    // Add custom handler
    config.handler = (req, res) => {
      // Log rate limit violation
      logger.warn('Rate limit exceeded', {
        type,
        ip: req.ip,
        user: req.user?.id,
        path: req.path,
        method: req.method
      });
      
      // Track in monitoring
      monitoringService.trackError(new Error('Rate limit exceeded'), {
        type,
        ip: req.ip,
        user: req.user?.id
      });
      
      // Audit log
      this.logRateLimitViolation(req, type);
      
      res.status(429).json({
        error: config.message,
        retryAfter: res.getHeader('Retry-After')
      });
    };
    
    // Add skip logic
    config.skip = async (req, res) => {
      // Skip for whitelisted IPs
      if (this.isWhitelisted(req.ip)) return true;
      
      // Skip for admin users
      if (req.user?.role === 'admin') return true;
      
      // Custom skip logic
      if (config.skipFunction) {
        return await config.skipFunction(req, res);
      }
      
      return false;
    };
    
    return rateLimit(config);
  }

  // Key generators
  defaultKeyGenerator(req) {
    return req.ip;
  }

  userKeyGenerator(req) {
    return req.user?.id || req.ip;
  }

  authKeyGenerator(req) {
    // Use combination of IP and username for auth endpoints
    const username = req.body?.email || req.body?.username;
    return `${req.ip}:${username || 'unknown'}`;
  }

  // Skip successful AI requests (only count failures)
  skipSuccessfulAIRequests(req, res) {
    return res.statusCode < 400;
  }

  // Check if IP is whitelisted
  isWhitelisted(ip) {
    const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
    return whitelist.includes(ip);
  }

  // Log rate limit violation
  async logRateLimitViolation(req, type) {
    try {
      await AuditLog.create({
        userId: req.user?.id || 'anonymous',
        action: 'RATE_LIMIT_EXCEEDED',
        entityType: 'System',
        metadata: {
          type,
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('user-agent')
        },
        ipAddress: req.ip,
        success: false,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to log rate limit violation:', error);
    }
  }

  // Get limiter for endpoint
  getLimiter(type) {
    if (!this.limiters.has(type)) {
      this.limiters.set(type, this.createLimiter(type));
    }
    return this.limiters.get(type);
  }

  // Dynamic rate limiting based on user behavior
  async getDynamicLimit(userId) {
    // Get user's recent activity
    const recentActivity = await AuditLog.find({
      userId,
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    }).limit(100);
    
    // Calculate trust score
    const violations = recentActivity.filter(a => !a.success).length;
    const trustScore = Math.max(0, 100 - violations * 10);
    
    // Adjust limits based on trust score
    if (trustScore < 30) {
      return { max: 10, windowMs: 60000 }; // Strict limits
    } else if (trustScore < 70) {
      return { max: 50, windowMs: 60000 }; // Normal limits
    } else {
      return { max: 200, windowMs: 60000 }; // Relaxed limits
    }
  }
}

// Request Signature Validation (for webhooks and API calls)
export class RequestValidator {
  constructor(secret) {
    this.secret = secret;
  }

  // Generate signature for request
  generateSignature(payload, timestamp) {
    const message = `${timestamp}.${JSON.stringify(payload)}`;
    return createHash('sha256')
      .update(message, 'utf8')
      .update(this.secret, 'utf8')
      .digest('hex');
  }

  // Validate request signature
  validateSignature(req, res, next) {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    
    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature headers' });
    }
    
    // Check timestamp to prevent replay attacks (5 minute window)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (Math.abs(now - requestTime) > 300000) {
      return res.status(401).json({ error: 'Request timestamp too old' });
    }
    
    // Validate signature
    const expectedSignature = this.generateSignature(req.body, timestamp);
    
    if (signature !== expectedSignature) {
      logger.warn('Invalid request signature', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();
  }
}

// Idempotency for payment and critical operations
export class IdempotencyManager {
  constructor() {
    this.requests = new Map();
    this.ttl = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Check and store idempotency key
  async checkIdempotency(req, res, next) {
    const idempotencyKey = req.headers['idempotency-key'];
    
    if (!idempotencyKey) {
      return res.status(400).json({ 
        error: 'Idempotency-Key header is required for this operation' 
      });
    }
    
    // Check if we've seen this key before
    if (this.requests.has(idempotencyKey)) {
      const cached = this.requests.get(idempotencyKey);
      
      // Return cached response
      logger.info('Returning cached response for idempotency key', {
        key: idempotencyKey
      });
      
      return res.status(cached.status).json(cached.body);
    }
    
    // Store the key and continue
    req.idempotencyKey = idempotencyKey;
    
    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = (body) => {
      this.requests.set(idempotencyKey, {
        status: res.statusCode,
        body,
        timestamp: Date.now()
      });
      
      // Clean up old entries
      setTimeout(() => {
        this.requests.delete(idempotencyKey);
      }, this.ttl);
      
      return originalJson.call(res, body);
    };
    
    next();
  }
}

// Two-Factor Authentication
export class TwoFactorAuth {
  constructor() {
    this.pendingVerifications = new Map();
  }

  // Generate 2FA secret
  generateSecret(userId, email) {
    const secret = speakeasy.generateSecret({
      name: `DentalAI:${email}`,
      length: 32
    });
    
    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url
    };
  }

  // Verify 2FA token
  verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps for clock drift
    });
  }

  // Generate backup codes
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  // Middleware to enforce 2FA
  enforce2FA(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user has 2FA enabled
    if (!req.user.twoFactorEnabled) {
      return next();
    }
    
    // Check if 2FA has been verified for this session
    const token = req.headers['x-2fa-token'];
    if (!token) {
      return res.status(403).json({ 
        error: '2FA verification required',
        require2FA: true
      });
    }
    
    // Verify the token
    if (!this.verifyToken(req.user.twoFactorSecret, token)) {
      return res.status(403).json({ error: 'Invalid 2FA token' });
    }
    
    next();
  }
}

// Session Security Manager
export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.config = {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      renewThreshold: 60 * 60 * 1000, // 1 hour
      maxSessions: 5, // Max concurrent sessions per user
      fingerprintCheck: true
    };
  }

  // Create session with device fingerprinting
  async createSession(userId, req) {
    const sessionId = randomBytes(32).toString('hex');
    const fingerprint = this.generateFingerprint(req);
    
    // Check concurrent sessions
    const userSessions = this.getUserSessions(userId);
    if (userSessions.length >= this.config.maxSessions) {
      // Remove oldest session
      const oldest = userSessions.sort((a, b) => a.createdAt - b.createdAt)[0];
      this.sessions.delete(oldest.id);
    }
    
    const session = {
      id: sessionId,
      userId,
      fingerprint,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
    
    this.sessions.set(sessionId, session);
    
    // Generate JWT with session ID
    const token = jwt.sign(
      { userId, sessionId, fingerprint },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    return { token, sessionId };
  }

  // Validate session
  validateSession(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const session = this.sessions.get(decoded.sessionId);
      
      if (!session) {
        return res.status(401).json({ error: 'Session expired' });
      }
      
      // Check fingerprint
      if (this.config.fingerprintCheck) {
        const currentFingerprint = this.generateFingerprint(req);
        if (currentFingerprint !== session.fingerprint) {
          logger.warn('Session fingerprint mismatch', {
            userId: session.userId,
            sessionId: session.id
          });
          
          // Possible session hijacking
          this.sessions.delete(session.id);
          return res.status(401).json({ error: 'Session invalid' });
        }
      }
      
      // Update last activity
      session.lastActivity = Date.now();
      
      // Check if token needs renewal
      if (Date.now() - session.createdAt > this.config.renewThreshold) {
        res.setHeader('X-Renewed-Token', this.renewToken(decoded));
      }
      
      req.user = { id: decoded.userId };
      req.session = session;
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Generate device fingerprint
  generateFingerprint(req) {
    const components = [
      req.get('user-agent'),
      req.get('accept-language'),
      req.get('accept-encoding'),
      req.ip
    ];
    
    return createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  // Get user sessions
  getUserSessions(userId) {
    const sessions = [];
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        sessions.push({ id, ...session });
      }
    }
    return sessions;
  }

  // Renew token
  renewToken(decoded) {
    return jwt.sign(
      { 
        userId: decoded.userId, 
        sessionId: decoded.sessionId,
        fingerprint: decoded.fingerprint
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // Cleanup expired sessions
  cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > this.config.maxAge) {
        this.sessions.delete(id);
      }
    }
  }
}

// Initialize services
const rateLimiter = new AdvancedRateLimiter();
const requestValidator = new RequestValidator(process.env.WEBHOOK_SECRET || 'secret');
const idempotencyManager = new IdempotencyManager();
const twoFactorAuth = new TwoFactorAuth();
const sessionManager = new SessionManager();

// Cleanup interval
setInterval(() => {
  sessionManager.cleanupSessions();
}, 60 * 60 * 1000); // Every hour

export {
  rateLimiter,
  requestValidator,
  idempotencyManager,
  twoFactorAuth,
  sessionManager
};