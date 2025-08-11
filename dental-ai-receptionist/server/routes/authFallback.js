import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

const router = express.Router();

// In-memory users for demo/development when MongoDB is not available
const inMemoryUsers = [
  {
    id: '1',
    email: 'admin@dentalcare.com',
    password: '$2a$10$YourHashedPasswordHere', // Will be set on first login
    name: 'Admin User',
    role: 'admin',
    profile: {
      firstName: 'Admin',
      lastName: 'User',
      phone: '555-0100'
    }
  },
  {
    id: '2',
    email: 'dentist@dentalcare.com',
    password: '$2a$10$YourHashedPasswordHere',
    name: 'Dr. Smith',
    role: 'dentist',
    profile: {
      firstName: 'John',
      lastName: 'Smith',
      phone: '555-0101',
      specialization: 'General Dentistry'
    }
  },
  {
    id: '3',
    email: 'patient@dentalcare.com',
    password: '$2a$10$YourHashedPasswordHere',
    name: 'Jane Doe',
    role: 'patient',
    profile: {
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '555-0102'
    }
  }
];

// Helper function to generate tokens
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    { expiresIn: '7d' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      type: 'refresh'
    },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    { expiresIn: '30d' }
  );
};

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role = 'patient' } = req.body;
    
    // Check if user already exists
    const existingUser = inMemoryUsers.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Parse name
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(' ') || 'User';

    // Create new user
    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name,
      role,
      profile: {
        firstName,
        lastName,
        phone: '000-0000'
      }
    };

    inMemoryUsers.push(newUser);
    logger.info(`New user registered (in-memory): ${email}`);

    const token = generateToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    res.status(201).json({
      message: 'Registration successful',
      token,
      refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        profile: newUser.profile
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    logger.info(`Login attempt for: ${email}`);
    
    // Find user
    let user = inMemoryUsers.find(u => u.email === email);
    
    if (!user) {
      logger.warn(`Login failed: User not found - ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // For demo purposes, if password hasn't been set, set it now
    if (user.password === '$2a$10$YourHashedPasswordHere') {
      user.password = await bcrypt.hash(password, 10);
      logger.info(`Password set for demo user: ${email}`);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      logger.warn(`Login failed: Invalid password for ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.info(`Login successful for: ${email}`);

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken, 
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
    );
    
    // Find user
    const user = inMemoryUsers.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Get current user endpoint
router.get('/me', (req, res) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
    );
    
    const user = inMemoryUsers.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profile: user.profile
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;