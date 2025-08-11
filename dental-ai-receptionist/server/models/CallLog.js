import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    index: true
  },
  patientName: String,
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  callType: {
    type: String,
    enum: ['incoming', 'outgoing', 'missed'],
    required: true
  },
  purpose: {
    type: String,
    enum: ['appointment', 'inquiry', 'emergency', 'follow-up', 'reminder', 'other'],
    default: 'other'
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: Date,
  duration: Number, // in seconds
  transcript: String,
  summary: String,
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative']
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  resolution: {
    type: String,
    enum: ['resolved', 'pending', 'escalated', 'transferred'],
    default: 'pending'
  },
  appointmentBooked: {
    type: Boolean,
    default: false
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: Date,
  followUpNotes: String,
  handledBy: {
    type: String,
    enum: ['ai', 'human', 'hybrid'],
    default: 'ai'
  },
  transferredTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  aiInteractionData: {
    confidence: Number,
    intentsDetected: [String],
    entitiesExtracted: [String],
    actionsPerformed: [String]
  },
  recordingUrl: String,
  notes: String,
  metadata: {
    callSid: String, // Twilio call ID
    direction: String,
    forwardedFrom: String,
    callerLocation: String,
    waitTime: Number // in seconds before answered
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
callLogSchema.index({ startTime: -1 });
callLogSchema.index({ patientId: 1, startTime: -1 });
callLogSchema.index({ purpose: 1, urgency: 1 });
callLogSchema.index({ resolution: 1, followUpRequired: 1 });

// Virtual for formatted duration
callLogSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return 'N/A';
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}m ${seconds}s`;
});

// Instance methods
callLogSchema.methods.calculateDuration = function() {
  if (this.startTime && this.endTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
    return this.duration;
  }
  return 0;
};

callLogSchema.methods.endCall = function() {
  this.endTime = new Date();
  this.duration = this.calculateDuration();
  return this.save();
};

callLogSchema.methods.addFollowUp = function(date, notes) {
  this.followUpRequired = true;
  this.followUpDate = date;
  this.followUpNotes = notes;
  return this.save();
};

// Static methods
callLogSchema.statics.getRecentCalls = function(limit = 10) {
  return this.find()
    .sort({ startTime: -1 })
    .limit(limit)
    .populate('patientId', 'name email phone')
    .populate('appointmentId', 'date time')
    .populate('transferredTo', 'name');
};

callLogSchema.statics.getMissedCalls = function() {
  return this.find({ 
    callType: 'missed',
    resolution: { $ne: 'resolved' }
  })
  .sort({ startTime: -1 })
  .populate('patientId', 'name email phone');
};

callLogSchema.statics.getEmergencyCalls = function(startDate, endDate) {
  const query = { 
    purpose: 'emergency',
    urgency: { $in: ['high', 'critical'] }
  };
  
  if (startDate && endDate) {
    query.startTime = { 
      $gte: startDate,
      $lte: endDate 
    };
  }
  
  return this.find(query)
    .sort({ startTime: -1 })
    .populate('patientId', 'name email phone');
};

callLogSchema.statics.getCallStats = async function(startDate, endDate) {
  const query = {};
  if (startDate && endDate) {
    query.startTime = { 
      $gte: startDate,
      $lte: endDate 
    };
  }

  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalCalls: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        avgDuration: { $avg: '$duration' },
        missedCalls: {
          $sum: { $cond: [{ $eq: ['$callType', 'missed'] }, 1, 0] }
        },
        emergencyCalls: {
          $sum: { $cond: [{ $eq: ['$purpose', 'emergency'] }, 1, 0] }
        },
        appointmentsBooked: {
          $sum: { $cond: ['$appointmentBooked', 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {
    totalCalls: 0,
    totalDuration: 0,
    avgDuration: 0,
    missedCalls: 0,
    emergencyCalls: 0,
    appointmentsBooked: 0
  };
};

const CallLog = mongoose.model('CallLog', callLogSchema);

export default CallLog;