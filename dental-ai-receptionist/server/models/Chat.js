import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['patient', 'dentist', 'receptionist', 'ai-assistant']
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    senderRole: {
      type: String,
      enum: ['patient', 'dentist', 'receptionist', 'ai-assistant']
    },
    content: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'system'],
      default: 'text'
    },
    attachments: [{
      url: String,
      type: String,
      name: String,
      size: Number
    }],
    metadata: {
      intent: String,
      sentiment: String,
      aiConfidence: Number,
      suggestedActions: [String]
    },
    isRead: {
      type: Boolean,
      default: false
    },
    readBy: [{
      userId: mongoose.Schema.Types.ObjectId,
      readAt: Date
    }],
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['active', 'waiting', 'resolved', 'archived'],
    default: 'active'
  },
  category: {
    type: String,
    enum: ['appointment', 'billing', 'medical', 'general', 'emergency']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  resolution: {
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    notes: String
  },
  aiAnalysis: {
    summary: String,
    keyPoints: [String],
    actionItems: [String],
    sentiment: {
      overall: String,
      score: Number
    },
    urgencyScore: Number
  },
  relatedAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

chatSchema.index({ conversationId: 1 });
chatSchema.index({ 'participants.userId': 1 });
chatSchema.index({ status: 1, priority: -1 });
chatSchema.index({ createdAt: -1 });

chatSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Chat', chatSchema);