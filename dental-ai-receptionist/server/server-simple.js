import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

import aiService from './services/aiService.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dental-ai';

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Store conversations in memory for now (in production, use MongoDB)
const conversations = new Map();

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// AI Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    // Get conversation history
    const history = conversations.get(sessionId) || [];
    
    // Process message with AI
    const result = await aiService.processMessage(message, history);
    
    // Update conversation history
    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.response }
    );
    conversations.set(sessionId, history);
    
    res.json(result);
  } catch (error) {
    logger.error('Chat endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      response: 'I apologize, but I encountered an error. Please try again.'
    });
  }
});

// Get available appointment slots (mock data for now)
app.get('/api/appointments/available', (req, res) => {
  const { date } = req.query;
  
  // Mock available slots
  const slots = [
    { time: '9:00 AM', available: true },
    { time: '10:00 AM', available: true },
    { time: '11:00 AM', available: false },
    { time: '2:00 PM', available: true },
    { time: '3:00 PM', available: true },
    { time: '4:00 PM', available: false }
  ];
  
  res.json({ date, slots });
});

// Book appointment (simplified)
app.post('/api/appointments/book', (req, res) => {
  const { date, time, name, phone, reason } = req.body;
  
  // In a real app, save to database
  logger.info('Appointment booked:', { date, time, name, phone, reason });
  
  res.json({
    success: true,
    message: 'Appointment booked successfully',
    appointment: {
      id: Date.now().toString(),
      date,
      time,
      name,
      phone,
      reason
    }
  });
});

// Socket.io for real-time chat
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);
  
  socket.on('chat:message', async (data) => {
    try {
      const { message, sessionId } = data;
      
      // Get conversation history
      const history = conversations.get(sessionId) || [];
      
      // Process with AI
      const result = await aiService.processMessage(message, history);
      
      // Update history
      history.push(
        { role: 'user', content: message },
        { role: 'assistant', content: result.response }
      );
      conversations.set(sessionId, history);
      
      // Send response back
      socket.emit('chat:response', result);
    } catch (error) {
      logger.error('Socket chat error:', error);
      socket.emit('chat:error', { 
        error: 'Failed to process message' 
      });
    }
  });
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Connect to MongoDB (optional for now)
mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((err) => {
    logger.warn('MongoDB connection failed, running without database:', err.message);
  });

// Start server
httpServer.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info('AI Receptionist is ready to assist!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});