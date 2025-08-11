import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String
  },
  userRole: {
    type: String,
    enum: ['patient', 'dentist', 'receptionist', 'admin', 'specialist']
  },
  action: {
    type: String,
    required: true,
    index: true,
    enum: [
      'CREATE',
      'READ',
      'UPDATE',
      'DELETE',
      'LOGIN',
      'LOGOUT',
      'PASSWORD_CHANGE',
      'PASSWORD_RESET',
      'ROLE_CHANGE',
      'APPOINTMENT_BOOK',
      'APPOINTMENT_CANCEL',
      'APPOINTMENT_RESCHEDULE',
      'PATIENT_ACCESS',
      'PATIENT_UPDATE',
      'TREATMENT_CREATE',
      'TREATMENT_UPDATE',
      'PAYMENT_PROCESS',
      'EXPORT_DATA',
      'IMPORT_DATA',
      'SETTINGS_UPDATE',
      'AI_INTERACTION',
      'EMERGENCY_CALL',
      'EMAIL_SENT',
      'SMS_SENT',
      'REPORT_GENERATE',
      'BACKUP_CREATE',
      'SYSTEM_CONFIG'
    ]
  },
  entityType: {
    type: String,
    required: true,
    index: true,
    enum: [
      'User',
      'Patient',
      'Appointment',
      'Treatment',
      'Payment',
      'Document',
      'Settings',
      'Report',
      'Chat',
      'Notification',
      'System'
    ]
  },
  entityId: {
    type: String,
    index: true
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  path: {
    type: String
  },
  query: {
    type: mongoose.Schema.Types.Mixed
  },
  body: {
    type: mongoose.Schema.Types.Mixed
  },
  previousValue: {
    type: mongoose.Schema.Types.Mixed
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed
  },
  statusCode: {
    type: Number
  },
  success: {
    type: Boolean,
    default: true,
    index: true
  },
  errorMessage: {
    type: String
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  sessionId: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  duration: {
    type: Number // Operation duration in milliseconds
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  flagged: {
    type: Boolean,
    default: false,
    index: true
  },
  reviewed: {
    type: Boolean,
    default: false
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ success: 1, timestamp: -1 });
auditLogSchema.index({ flagged: 1, reviewed: 1 });
auditLogSchema.index({ riskLevel: 1, timestamp: -1 });

// TTL index to auto-delete logs after 1 year (configurable)
auditLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);

// Virtual for formatted timestamp
auditLogSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Methods
auditLogSchema.methods.flag = async function(reason) {
  this.flagged = true;
  this.metadata = {
    ...this.metadata,
    flagReason: reason,
    flaggedAt: new Date()
  };
  return this.save();
};

auditLogSchema.methods.review = async function(userId, notes) {
  this.reviewed = true;
  this.reviewedBy = userId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  return this.save();
};

// Statics
auditLogSchema.statics.findSuspiciousActivity = async function(timeRange = 24) {
  const since = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: since },
        $or: [
          { success: false },
          { riskLevel: { $in: ['high', 'critical'] } },
          { flagged: true }
        ]
      }
    },
    {
      $group: {
        _id: {
          userId: '$userId',
          ipAddress: '$ipAddress'
        },
        count: { $sum: 1 },
        actions: { $push: '$action' },
        failures: {
          $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
        }
      }
    },
    {
      $match: {
        $or: [
          { count: { $gte: 10 } }, // Many attempts
          { failures: { $gte: 5 } } // Many failures
        ]
      }
    }
  ]);
};

auditLogSchema.statics.getUserActivity = async function(userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.find({
    userId,
    timestamp: { $gte: since }
  })
  .sort({ timestamp: -1 })
  .limit(1000);
};

auditLogSchema.statics.getSystemStats = async function(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: since }
      }
    },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        successCount: {
          $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] }
        },
        failureCount: {
          $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
        },
        actionTypes: {
          $push: '$action'
        },
        avgDuration: { $avg: '$duration' }
      }
    },
    {
      $project: {
        _id: 0,
        totalActions: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        successCount: 1,
        failureCount: 1,
        successRate: {
          $multiply: [
            { $divide: ['$successCount', '$totalActions'] },
            100
          ]
        },
        avgDuration: 1,
        mostCommonActions: {
          $slice: [
            {
              $reduce: {
                input: '$actionTypes',
                initialValue: [],
                in: {
                  $concatArrays: ['$$value', ['$$this']]
                }
              }
            },
            10
          ]
        }
      }
    }
  ]);
};

// Middleware to determine risk level
auditLogSchema.pre('save', function(next) {
  // Determine risk level based on action
  const highRiskActions = [
    'DELETE',
    'PASSWORD_CHANGE',
    'ROLE_CHANGE',
    'PAYMENT_PROCESS',
    'EXPORT_DATA',
    'SYSTEM_CONFIG'
  ];
  
  const criticalActions = [
    'BACKUP_CREATE',
    'IMPORT_DATA'
  ];
  
  if (criticalActions.includes(this.action)) {
    this.riskLevel = 'critical';
  } else if (highRiskActions.includes(this.action)) {
    this.riskLevel = 'high';
  } else if (!this.success) {
    this.riskLevel = 'medium';
  } else {
    this.riskLevel = 'low';
  }
  
  // Auto-flag suspicious activities
  if (
    this.riskLevel === 'critical' ||
    (this.riskLevel === 'high' && !this.success)
  ) {
    this.flagged = true;
  }
  
  next();
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;