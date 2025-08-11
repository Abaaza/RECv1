import express from 'express';
import { body, validationResult } from 'express-validator';
import Chat from '../models/Chat.js';
import { io } from '../server.js';
import { analyzeMessage } from '../services/aiService.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get('/conversations', async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const query = {};

    if (req.user.role === 'patient') {
      query['participants.userId'] = req.user._id;
    }

    if (status) query.status = status;
    if (category) query.category = category;

    const conversations = await Chat.find(query)
      .select('-messages')
      .populate('participants.userId', 'profile.firstName profile.lastName')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Chat.countDocuments(query);

    res.json({
      conversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/conversations/:conversationId', async (req, res) => {
  try {
    const conversation = await Chat.findOne({ 
      conversationId: req.params.conversationId 
    }).populate('participants.userId', 'profile.firstName profile.lastName');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (req.user.role === 'patient') {
      const isParticipant = conversation.participants.some(
        p => p.userId && p.userId._id.toString() === req.user._id.toString()
      );
      if (!isParticipant) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const unreadMessages = conversation.messages.filter(
      msg => !msg.isRead && msg.senderId?.toString() !== req.user._id.toString()
    );

    for (const msg of unreadMessages) {
      msg.isRead = true;
      msg.readBy.push({
        userId: req.user._id,
        readAt: new Date()
      });
    }

    await conversation.save();

    res.json(conversation);
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.post('/conversations', [
  body('category').isIn(['appointment', 'billing', 'medical', 'general', 'emergency']),
  body('message').notEmpty(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { category, message, priority = 'medium' } = req.body;
    const conversationId = uuidv4();

    const aiAnalysis = await analyzeMessage(message);

    const conversation = new Chat({
      conversationId,
      participants: [{
        userId: req.user._id,
        role: req.user.role
      }],
      messages: [{
        senderId: req.user._id,
        senderRole: req.user.role,
        content: message,
        metadata: aiAnalysis
      }],
      category,
      priority: aiAnalysis.urgency || priority,
      aiAnalysis: {
        summary: aiAnalysis.summary,
        sentiment: aiAnalysis.sentiment,
        urgencyScore: aiAnalysis.urgencyScore
      }
    });

    await conversation.save();
    await conversation.populate('participants.userId', 'profile.firstName profile.lastName');

    io.to('support').emit('new_conversation', {
      conversationId,
      category,
      priority: conversation.priority,
      user: req.user.profile
    });

    logger.info(`New conversation created: ${conversationId}`);

    res.status(201).json(conversation);
  } catch (error) {
    logger.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.post('/conversations/:conversationId/messages', [
  body('content').notEmpty(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { content, type = 'text', attachments = [] } = req.body;

    const conversation = await Chat.findOne({ 
      conversationId: req.params.conversationId 
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const aiAnalysis = await analyzeMessage(content);

    const message = {
      senderId: req.user._id,
      senderRole: req.user.role,
      content,
      type,
      attachments,
      metadata: aiAnalysis,
      timestamp: new Date()
    };

    conversation.messages.push(message);
    conversation.status = 'active';
    conversation.updatedAt = new Date();

    if (aiAnalysis.urgencyScore > 0.7) {
      conversation.priority = 'urgent';
    }

    await conversation.save();

    io.to(`conversation:${req.params.conversationId}`).emit('new_message', {
      conversationId: req.params.conversationId,
      message
    });

    if (req.user.role === 'patient' && conversation.status === 'waiting') {
      io.to('support').emit('customer_reply', {
        conversationId: req.params.conversationId,
        customer: req.user.profile
      });
    }

    res.json(message);
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.put('/conversations/:conversationId/status', [
  body('status').isIn(['active', 'waiting', 'resolved', 'archived']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { status } = req.body;

    const conversation = await Chat.findOneAndUpdate(
      { conversationId: req.params.conversationId },
      { 
        status,
        ...(status === 'resolved' && {
          'resolution.resolved': true,
          'resolution.resolvedBy': req.user._id,
          'resolution.resolvedAt': new Date()
        })
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    io.to(`conversation:${req.params.conversationId}`).emit('status_changed', {
      conversationId: req.params.conversationId,
      status
    });

    logger.info(`Conversation status updated: ${req.params.conversationId} to ${status}`);

    res.json(conversation);
  } catch (error) {
    logger.error('Error updating conversation status:', error);
    res.status(500).json({ error: 'Failed to update conversation status' });
  }
});

router.post('/conversations/:conversationId/typing', async (req, res) => {
  try {
    const { isTyping } = req.body;

    io.to(`conversation:${req.params.conversationId}`).emit('typing_indicator', {
      conversationId: req.params.conversationId,
      userId: req.user._id,
      userName: `${req.user.profile.firstName} ${req.user.profile.lastName}`,
      isTyping
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error sending typing indicator:', error);
    res.status(500).json({ error: 'Failed to send typing indicator' });
  }
});

export default router;