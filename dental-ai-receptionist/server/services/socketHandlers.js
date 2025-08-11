import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import { logger } from '../utils/logger.js';

export const initSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.user = user;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.email}`);

    if (socket.user.role === 'receptionist' || socket.user.role === 'dentist') {
      socket.join('support');
    }

    socket.join(`user:${socket.user._id}`);

    socket.on('join_conversation', async (conversationId) => {
      try {
        const conversation = await Chat.findOne({ conversationId });
        
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        const isParticipant = conversation.participants.some(
          p => p.userId?.toString() === socket.user._id.toString()
        );

        const canJoin = isParticipant || 
          socket.user.role === 'receptionist' || 
          socket.user.role === 'dentist' ||
          socket.user.role === 'admin';

        if (!canJoin) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        
        if (!isParticipant && (socket.user.role === 'receptionist' || socket.user.role === 'dentist')) {
          conversation.participants.push({
            userId: socket.user._id,
            role: socket.user.role,
            joinedAt: new Date()
          });
          await conversation.save();
        }

        socket.emit('joined_conversation', { conversationId });
        
        socket.to(`conversation:${conversationId}`).emit('user_joined', {
          conversationId,
          user: {
            id: socket.user._id,
            name: `${socket.user.profile.firstName} ${socket.user.profile.lastName}`,
            role: socket.user.role
          }
        });

        logger.info(`User ${socket.user.email} joined conversation ${conversationId}`);
      } catch (error) {
        logger.error('Error joining conversation:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      
      socket.to(`conversation:${conversationId}`).emit('user_left', {
        conversationId,
        user: {
          id: socket.user._id,
          name: `${socket.user.profile.firstName} ${socket.user.profile.lastName}`
        }
      });

      logger.info(`User ${socket.user.email} left conversation ${conversationId}`);
    });

    socket.on('typing_start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        conversationId,
        user: {
          id: socket.user._id,
          name: `${socket.user.profile.firstName} ${socket.user.profile.lastName}`
        }
      });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
        conversationId,
        userId: socket.user._id
      });
    });

    socket.on('mark_read', async ({ conversationId, messageIds }) => {
      try {
        const conversation = await Chat.findOne({ conversationId });
        
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        for (const messageId of messageIds) {
          const message = conversation.messages.id(messageId);
          if (message && !message.isRead) {
            message.isRead = true;
            message.readBy.push({
              userId: socket.user._id,
              readAt: new Date()
            });
          }
        }

        await conversation.save();

        socket.to(`conversation:${conversationId}`).emit('messages_read', {
          conversationId,
          messageIds,
          readBy: socket.user._id
        });
      } catch (error) {
        logger.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    socket.on('request_support', async ({ category, urgency }) => {
      try {
        io.to('support').emit('support_requested', {
          user: {
            id: socket.user._id,
            name: `${socket.user.profile.firstName} ${socket.user.profile.lastName}`,
            email: socket.user.email
          },
          category,
          urgency,
          timestamp: new Date()
        });

        socket.emit('support_request_received');
        
        logger.info(`Support requested by ${socket.user.email} - Category: ${category}, Urgency: ${urgency}`);
      } catch (error) {
        logger.error('Error requesting support:', error);
        socket.emit('error', { message: 'Failed to request support' });
      }
    });

    socket.on('agent_accept_chat', async ({ conversationId }) => {
      try {
        const conversation = await Chat.findOne({ conversationId });
        
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        conversation.participants.push({
          userId: socket.user._id,
          role: socket.user.role,
          joinedAt: new Date()
        });

        conversation.status = 'active';
        await conversation.save();

        socket.join(`conversation:${conversationId}`);

        io.to(`conversation:${conversationId}`).emit('agent_joined', {
          conversationId,
          agent: {
            id: socket.user._id,
            name: `${socket.user.profile.firstName} ${socket.user.profile.lastName}`,
            role: socket.user.role
          }
        });

        logger.info(`Agent ${socket.user.email} accepted chat ${conversationId}`);
      } catch (error) {
        logger.error('Error accepting chat:', error);
        socket.emit('error', { message: 'Failed to accept chat' });
      }
    });

    socket.on('update_presence', ({ status }) => {
      socket.user.presence = status;
      
      io.to('support').emit('agent_presence_update', {
        agentId: socket.user._id,
        status
      });
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.user.email}`);
      
      io.to('support').emit('agent_presence_update', {
        agentId: socket.user._id,
        status: 'offline'
      });
    });
  });
};