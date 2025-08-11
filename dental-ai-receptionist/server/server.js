import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import authFallbackRoutes from './routes/authFallback.js';
import patientRoutes from './routes/patients.js';
import patientsV2Routes from './routes/patientsv2.js';
import appointmentRoutes from './routes/appointments.js';
import chatRoutes from './routes/chat.js';
import analyticsRoutes from './routes/analytics.js';
import analyticsV2Routes from './routes/analyticsv2.js';
import notificationRoutes from './routes/notifications.js';
import aiRoutes from './routes/ai.js';
import deepgramRoutes from './routes/deepgram.js';
import statsRoutes from './routes/stats.js';
import scheduleRoutes from './routes/schedule.js';
import emergencyRoutes from './routes/emergency.js';
import insuranceRoutes from './routes/insurance.js';
import treatmentPlanRoutes from './routes/treatmentPlans.js';
import smartSchedulingRoutes from './routes/smartScheduling.js';
import errorRoutes from './routes/errors.js';

import { authenticateToken } from './middleware/auth.js';
import { errorHandler, setServer } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { initScheduledTasks } from './services/scheduledTasks.js';
import { initSocketHandlers } from './services/socketHandlers.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dental-ai';
let isMongoConnected = false;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// Use original auth routes with MongoDB
app.use('/api/auth', authRoutes);
app.use('/api/patients', authenticateToken, patientRoutes);
app.use('/api/patientsv2', patientsV2Routes); // New patient routes without auth for testing
app.use('/api/appointments', appointmentRoutes); // Temporarily removed auth for testing
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/analyticsv2', analyticsV2Routes); // New analytics routes without auth for testing
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/ai', aiRoutes); // Temporarily removed auth for testing
app.use('/api/deepgram', deepgramRoutes); // No auth needed for TTS
app.use('/api/stats', statsRoutes); // Stats route without auth for dashboard
app.use('/api/schedule', scheduleRoutes); // Schedule management routes
app.use('/api/emergency', emergencyRoutes); // Emergency handling
app.use('/api/insurance', insuranceRoutes); // Insurance management
app.use('/api/treatment-plans', treatmentPlanRoutes); // Treatment plans
app.use('/api/smart-scheduling', smartSchedulingRoutes); // Smart scheduling with AI
app.use('/api/errors', errorRoutes); // Error logging and monitoring

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

// Try to connect to MongoDB but continue without it if unavailable
mongoose.connect(MONGODB_URI)
.then(() => {
  logger.info('Connected to MongoDB');
  isMongoConnected = true;
})
.catch(err => {
  logger.warn('MongoDB connection failed, running without database:', err.message);
  logger.info('Note: Data will not be persisted without MongoDB');
  logger.info('Using in-memory authentication fallback');
  isMongoConnected = false;
});

// Initialize services and start server regardless of MongoDB connection
initScheduledTasks();
initSocketHandlers(io);

const server = httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('🦷 Dental AI Receptionist is ready!');
  logger.info(`Frontend should connect to: http://localhost:${PORT}`);
});

// Set server instance for graceful error handling
setServer(server);

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  // Don't exit on MongoDB connection failure
  // process.exit(1);
});

export { io };