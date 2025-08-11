import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientModel',
    required: true,
    index: true
  },
  recipientModel: {
    type: String,
    enum: ['User', 'Patient'],
    required: true
  },
  type: {
    type: String,
    enum: [
      'appointment_reminder',
      'appointment_confirmation',
      'appointment_cancellation',
      'appointment_rescheduled',
      'appointment_new',
      'emergency',
      'treatment_reminder',
      'payment_due',
      'payment_received',
      'insurance_update',
      'lab_results',
      'prescription_ready',
      'follow_up',
      'birthday',
      'system_alert',
      'staff_message',
      'patient_message'
    ],
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient'
    },
    emergencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Emergency'
    },
    treatmentPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentPlan'
    },
    amount: Number,
    link: String,
    actionRequired: Boolean,
    actionType: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  channels: [{
    type: String,
    enum: ['in_app', 'email', 'sms', 'push', 'voice'],
    required: true
  }],
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  failedAt: Date,
  failureReason: String,
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  scheduledFor: {
    type: Date,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  channelStatus: {
    in_app: {
      status: String,
      sentAt: Date,
      deliveredAt: Date,
      readAt: Date,
      error: String
    },
    email: {
      status: String,
      sentAt: Date,
      deliveredAt: Date,
      openedAt: Date,
      bounced: Boolean,
      error: String,
      messageId: String
    },
    sms: {
      status: String,
      sentAt: Date,
      deliveredAt: Date,
      error: String,
      messageId: String,
      cost: Number
    },
    push: {
      status: String,
      sentAt: Date,
      deliveredAt: Date,
      clickedAt: Date,
      error: String,
      deviceTokens: [String]
    },
    voice: {
      status: String,
      sentAt: Date,
      answeredAt: Date,
      duration: Number,
      error: String,
      callSid: String
    }
  },
  groupId: String, // For batch notifications
  templateId: String,
  templateVariables: mongoose.Schema.Types.Mixed,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String],
  isAutomated: {
    type: Boolean,
    default: false
  },
  automationRuleId: String,
  userActions: [{
    action: String,
    timestamp: Date,
    metadata: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, priority: 1, status: 1 });
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ groupId: 1 });

// Virtual for delivery status across all channels
notificationSchema.virtual('overallDeliveryStatus').get(function() {
  const channelStatuses = [];
  for (const channel of this.channels) {
    if (this.channelStatus[channel]) {
      channelStatuses.push(this.channelStatus[channel].status);
    }
  }
  
  if (channelStatuses.every(s => s === 'delivered' || s === 'read')) {
    return 'success';
  } else if (channelStatuses.some(s => s === 'delivered' || s === 'read')) {
    return 'partial';
  } else if (channelStatuses.every(s => s === 'failed')) {
    return 'failed';
  }
  return 'pending';
});

// Instance methods
notificationSchema.methods.markAsSent = function(channel = null) {
  if (channel) {
    if (!this.channelStatus[channel]) {
      this.channelStatus[channel] = {};
    }
    this.channelStatus[channel].status = 'sent';
    this.channelStatus[channel].sentAt = new Date();
  } else {
    this.status = 'sent';
    this.sentAt = new Date();
  }
  return this.save();
};

notificationSchema.methods.markAsDelivered = function(channel = null) {
  if (channel) {
    if (!this.channelStatus[channel]) {
      this.channelStatus[channel] = {};
    }
    this.channelStatus[channel].status = 'delivered';
    this.channelStatus[channel].deliveredAt = new Date();
  } else {
    this.status = 'delivered';
    this.deliveredAt = new Date();
  }
  return this.save();
};

notificationSchema.methods.markAsRead = function(channel = null) {
  if (channel) {
    if (!this.channelStatus[channel]) {
      this.channelStatus[channel] = {};
    }
    this.channelStatus[channel].status = 'read';
    this.channelStatus[channel].readAt = new Date();
  } else {
    this.status = 'read';
    this.readAt = new Date();
  }
  return this.save();
};

notificationSchema.methods.markAsFailed = function(reason, channel = null) {
  if (channel) {
    if (!this.channelStatus[channel]) {
      this.channelStatus[channel] = {};
    }
    this.channelStatus[channel].status = 'failed';
    this.channelStatus[channel].error = reason;
  } else {
    this.status = 'failed';
    this.failedAt = new Date();
    this.failureReason = reason;
  }
  this.attempts += 1;
  return this.save();
};

notificationSchema.methods.retry = function() {
  if (this.attempts < this.maxAttempts) {
    this.status = 'pending';
    this.failureReason = null;
    this.failedAt = null;
    return this.save();
  }
  return null;
};

notificationSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

notificationSchema.methods.addUserAction = function(action, metadata = {}) {
  this.userActions.push({
    action,
    timestamp: new Date(),
    metadata
  });
  return this.save();
};

// Static methods
notificationSchema.statics.getUnreadForRecipient = function(recipientId, recipientModel = 'User') {
  return this.find({
    recipientId,
    recipientModel,
    status: { $in: ['sent', 'delivered'] }
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(50);
};

notificationSchema.statics.getRecentForRecipient = function(recipientId, recipientModel = 'User', limit = 20) {
  return this.find({
    recipientId,
    recipientModel
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('data.appointmentId')
  .populate('data.patientId');
};

notificationSchema.statics.getPendingScheduled = function() {
  return this.find({
    status: 'pending',
    scheduledFor: { $lte: new Date() }
  })
  .sort({ priority: -1, scheduledFor: 1 });
};

notificationSchema.statics.getExpired = function() {
  return this.find({
    status: { $in: ['pending', 'sent'] },
    expiresAt: { $lte: new Date() }
  });
};

notificationSchema.statics.markAllAsReadForRecipient = async function(recipientId, recipientModel = 'User', type = null) {
  const query = {
    recipientId,
    recipientModel,
    status: { $in: ['sent', 'delivered'] }
  };
  
  if (type) {
    query.type = type;
  }
  
  return this.updateMany(query, {
    $set: {
      status: 'read',
      readAt: new Date()
    }
  });
};

notificationSchema.statics.getNotificationStats = async function(startDate, endDate) {
  const query = {};
  if (startDate && endDate) {
    query.createdAt = {
      $gte: startDate,
      $lte: endDate
    };
  }

  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        sent: {
          $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
        },
        delivered: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        read: {
          $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        }
      }
    }
  ]);

  const byType = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const byChannel = await this.aggregate([
    { $match: query },
    { $unwind: '$channels' },
    {
      $group: {
        _id: '$channels',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return {
    ...(stats[0] || {
      total: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0
    }),
    byType,
    byChannel,
    deliveryRate: stats[0] ? ((stats[0].delivered + stats[0].read) / stats[0].total * 100).toFixed(2) : 0,
    readRate: stats[0] ? (stats[0].read / (stats[0].delivered + stats[0].read) * 100).toFixed(2) : 0
  };
};

// Middleware to handle expiration
notificationSchema.pre('save', function(next) {
  // Set default expiration if not set
  if (!this.expiresAt && this.isNew) {
    const expirationHours = {
      urgent: 24,
      high: 48,
      normal: 72,
      low: 168 // 1 week
    };
    const hours = expirationHours[this.priority] || 72;
    this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  }
  next();
});

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;